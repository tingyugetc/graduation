/**
 * Created by fengyuanzemin on 2017/3/14.
 */
import Weight from '../models/postWeight';
import MovieWeight from '../models/movieWeight';
import Action from '../models/postAction';
import MovieAction from '../models/movieAction';
import User from '../models/user';
import Post from '../models/post';
import Movie from '../models/movie';
import Similar from '../models/similar';
import RelationShip from '../models/relationship';
import HotWeibo from '../models/postHot';
import { pointComputed, moviePointComputed, operation } from '../utils';

// 只返回推荐人id
export async function recommend(user) {
    try {
        let recommend = [];
        // 查找是谁的推荐人
        let recommendFollow = [];
        const sim = await Similar.find({$or: [{userA: user._id}, {userB: user._id}]})
            .sort('-similar');
        for (let s of sim) {
            const re = await RelationShip.findOne({
                $or: [{
                    follower: user._id,
                    following: s.userA
                }, {
                    follower: user._id,
                    following: s.userB
                }]
            });
            // 没有关注过
            if (!re) {
                recommendFollow.push(s);
            }
        }
        for (let i of recommendFollow) {
            const id = String(i.userA) === String(user._id) ? i.userB : i.userA;
            recommend.push(id);
        }
        return recommend;
    } catch (err) {
        console.log(err);
    }
}

export async function hot() {
    try {
        /**
         * 热门度
         * 点赞 0.2
         * 转发 0.8
         * 查看 0.1
         * 评论 0.7
         */
        await HotWeibo.remove({});
        const action = await Action.find({}).sort('post');
        // 把post相同的加起来
        for (let i = 0; i < action.length; i += 1) {
            let hotPoint = pointComputed(action[i].action);
            // 后面放置i的下一个循环的值
            let n = i;
            for (let j = i + 1; j < action.length; j += 1) {
                if (String(action[i].post) === String(action[j].post)) {
                    hotPoint += pointComputed(action[j].action);
                    n = j;
                }
            }
            await new HotWeibo({
                post: action[i].post,
                point: hotPoint
            }).save();
            i = n;
        }
    } catch (err) {
        console.log(err);
    }
}

// 根据用户微博/电影的行为计算相似度，并保存在similar表和weight表
export async function similar() {
    try {
        // 将Weight清空
        await Weight.remove({});
        // 将MovieWeight清空
        await MovieWeight.remove({});
        // 将Similar清空
        await Similar.remove({});

        /*
         * 第一步：
         *
         * 计算Weight
         * 权值：
         * 点赞 0.2
         * 转发 0.8
         * 查看 0.1
         * 评论 0.7
         */
        // 找到所有的用户
        let user = await User.find({});
        // 将用户id放入数组里
        let userId = user.map(item => item._id);
        // 每次循环代表不同的用户
        for (let item of userId) {
            // 找到用户所有的行为
            // 将相同postID的生成一个weight
            let action = await Action.find({user: item}).sort('post');
            // 每次循环代表不同的用户行为
            for (let j = 0; j < action.length; j += 1) {
                let flag = 0;
                let postId = '';
                let actionSum = 0;
                for (let i = j; i < action.length; i += 1) {
                    if (!flag) {
                        postId = action[i].post;
                        actionSum += pointComputed(action[i].action);
                        flag += 1;
                    } else if (String(action[i].post) === String(postId)) {
                        actionSum += pointComputed(action[i].action);
                        j = i;
                    }
                    // 循环到最后面就存进weight
                    if (i === action.length - 1) {
                        await new Weight({
                            user: item,
                            post: postId,
                            maxSum: actionSum
                        }).save();
                    }
                }
            }
            // 电影
            let movieAction = await MovieAction.find({user: item}).sort('movie');
            for (let j = 0; j < movieAction.length; j += 1) {
                let flag = 0;
                let movieId = '';
                let actionSum = 0;
                for (let i = j; i < movieAction.length; i += 1) {
                    if (!flag) {
                        movieId = movieAction[i].movie;
                        actionSum += moviePointComputed(movieAction[i].action, movieAction[i].rating);
                        flag += 1;
                    } else if (String(movieAction[i].movie) === String(movieId)) {
                        actionSum += moviePointComputed(movieAction[i].action, movieAction[i].rating);
                        j = i;
                    }
                    // 循环到最后面就存进weight
                    if (i === movieAction.length - 1) {
                        await new MovieWeight({
                            user: item,
                            movie: movieId,
                            maxSum: actionSum
                        }).save();
                    }
                }
            }
        }
        // 找到最大值
        let weightMax = await Weight.findOne({}).sort('-maxSum');
        let weightArr = await Weight.find({});
        for (let i of weightArr) {
            i.point = i.maxSum / weightMax.maxSum;
            await i.save();
        }
        // 找到电影最大值
        let movieWeightMax = await MovieWeight.findOne({}).sort('-maxSum');
        let movieWeightArr = await MovieWeight.find({});
        for (let i of movieWeightArr) {
            i.point = i.maxSum / movieWeightMax.maxSum;
            await i.save();
        }

        /*
         * 第二步：
         *
         * 计算InterAction
         *
         */
        // 微博
        weightArr = await Weight.find({}).sort('user').populate('post');
        for (let i = 0; i < weightArr.length; i += 1) {
            // A -> B
            let tempA = '', tempB = '', tempSumA = 0, countA = 0;
            // B -> A
            let tempSumB = 0, countB = 0;
            for (let j = i; j < weightArr.length; j += 1) {
                // 计算A对B的直接交互度，A、B不能相等
                if (String(weightArr[j].user) !== String(weightArr[j].post.user)) {
                    if (!countA) {
                        tempA = weightArr[j].user;
                        tempB = weightArr[j].post.user;
                        tempSumA += weightArr[j].point;
                        countA += 1;
                        i = j;
                    } else if (String(weightArr[j].user) === String(tempA) &&
                        String(weightArr[j].post.user) === String(tempB)) {
                        tempSumA += weightArr[j].point;
                        // 这个是跳过前面user一样的
                        i = j;
                        countA += 1;
                    }
                }
            }
            for (let k = i + 1; k < weightArr.length; k += 1) {
                // 计算B对A的直接交互度，A、B不能相等
                if (String(weightArr[k].user) !== String(weightArr[k].post.user) &&
                    String(weightArr[k].user) === String(tempB) &&
                    String(weightArr[k].post.user) === String(tempA)) {
                    tempSumB += weightArr[k].point;
                    countB += 1;
                    weightArr.splice(k--, 1)
                }
            }
            if (countA || countB) {
                await new Similar({
                    userA: tempA,
                    userB: tempB,
                    interAction: (tempSumA + tempSumB) / (countA + countB)
                }).save();
            }
        }
        // 电影的话，A对B没有直接交互，都是通过电影间接交互的

        /*
         * 第三步：
         *
         * 计算Coupling
         *
         */
        // 微博
        weightArr = await Weight.find({}).sort('user');
        let combination = [];
        let combinationUser = '';
        for (let i = 0; i < weightArr.length - 1; i += 1) {
            if (!i) {
                combinationUser = weightArr[i].user;
                if (String(weightArr[i].user) !== String(weightArr[i + 1].user)) {
                    combination.push(weightArr.splice(0, i + 1));
                    i = -1;
                }
            } else if (String(weightArr[i].user) !== String(weightArr[i + 1].user) &&
                String(weightArr[i].user) === String(weightArr[i - 1].user)) {
                combination.push(weightArr.splice(0, i + 1));
                i = -1;
            }
        }
        combination.push(weightArr);
        // 求交集
        for (let i = 0; i < combination.length; i += 1) {
            for (let j = i + 1; j < combination.length; j += 1) {
                let intersectionA = operation(combination[i], combination[j], 'post');
                let intersectionB = operation(combination[j], combination[i], 'post');
                if (intersectionA.length > 0) {
                    let interactionSum = 0;
                    let interactionSumA = 0;
                    let interactionSumB = 0;
                    let interactionMax = 0;
                    for (let m = 0; m < intersectionA.length; m += 1) {
                        interactionSum += intersectionA[m].point > intersectionB[m].point ? intersectionB[m].point : intersectionA[m].point;
                        interactionSumA += intersectionA[m].point;
                        interactionSumB += intersectionB[m].point;
                    }
                    interactionMax = interactionSumA > interactionSumB ? interactionSumA : interactionSumB;
                    // 查找是否存在Similar
                    const s = await Similar.findOne({
                        $or: [{
                            userA: intersectionA[0].user,
                            userB: intersectionB[0].user
                        }, {
                            userA: intersectionB[0].user,
                            userB: intersectionA[0].user
                        }]
                    });
                    if (s) {
                        s.coupling = interactionSum / interactionMax;
                        await s.save();
                    } else {
                        await new Similar({
                            userA: intersectionA[0].user,
                            userB: intersectionB[0].user,
                            coupling: interactionSum / interactionMax
                        }).save();
                    }
                }
            }
        }

        // 电影
        weightArr = await MovieWeight.find({}).sort('user');
        combination = [];
        combinationUser = '';
        for (let i = 0; i < weightArr.length - 1; i += 1) {
            if (!i) {
                combinationUser = weightArr[i].user;
                if (String(weightArr[i].user) !== String(weightArr[i + 1].user)) {
                    combination.push(weightArr.splice(0, i + 1));
                    i = -1;
                }
            } else if (String(weightArr[i].user) !== String(weightArr[i + 1].user) &&
                String(weightArr[i].user) === String(weightArr[i - 1].user)) {
                combination.push(weightArr.splice(0, i + 1));
                i = -1;
            }
        }
        combination.push(weightArr);
        // 求交集
        for (let i = 0; i < combination.length; i += 1) {
            for (let j = i + 1; j < combination.length; j += 1) {
                let intersectionA = operation(combination[i], combination[j], 'movie');
                let intersectionB = operation(combination[j], combination[i], 'movie');
                if (intersectionA.length > 0) {
                    let interactionSum = 0;
                    let interactionSumA = 0;
                    let interactionSumB = 0;
                    let interactionMax = 0;
                    for (let m = 0; m < intersectionA.length; m += 1) {
                        interactionSum += intersectionA[m].point > intersectionB[m].point ? intersectionB[m].point : intersectionA[m].point;
                        interactionSumA += intersectionA[m].point;
                        interactionSumB += intersectionB[m].point;
                    }
                    interactionMax = interactionSumA > interactionSumB ? interactionSumA : interactionSumB;
                    // 查找是否存在Similar
                    const s = await Similar.findOne({
                        $or: [{
                            userA: intersectionA[0].user,
                            userB: intersectionB[0].user
                        }, {
                            userA: intersectionB[0].user,
                            userB: intersectionA[0].user
                        }]
                    });
                    if (s) {
                        // 如果之前在微博上已经有间接交互度了
                        const newCoupling = interactionSum / interactionMax;
                        s.coupling = (newCoupling + s.coupling) /
                            (s.coupling > newCoupling ? 2 * s.coupling : 2 * newCoupling);
                        await s.save();
                    } else {
                        await new Similar({
                            userA: intersectionA[0].user,
                            userB: intersectionB[0].user,
                            coupling: interactionSum / interactionMax
                        }).save();
                    }
                }
            }
        }

        /*
         * 第四步：
         *
         * 计算Similar
         *
         */
        let sim = await Similar.find({});
        for (let si of sim) {
            si.similar = 0.7 * si.interAction + 0.3 * si.coupling;
            await si.save();
        }
    } catch (err) {
        console.log(err)
    }
}
