/**
 * Created by fengyuanzemin on 2017/3/14.
 */
import Weight from '../models/weight';
import Action from '../models/action';
import User from '../models/user';
import Post from '../models/post';
import Similar from '../models/similar';

// export default function similar() {
//
// }

export async function calculateSimilar() {
    let action = [];
    try {
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
        // 将Weight清空
        await Weight.remove({});
        await Similar.remove({});
        // 找到所有的用户
        let user = await User.find({});
        // 将用户id放入数组里
        let userId = user.map(item => item._id);
        // 每次循环代表不同的用户
        for (let item of userId) {
            // 找到用户所有的行为
            // 将相同postID的生成一个weight
            action = await Action.find({user: item}).sort('post');
            // 每次循环代表不同的用户行为
            for (let j = 0; j < action.length; j += 1) {
                let flag = 0;
                let postId = '';
                let actionSum = 0;
                for (let i = j; i < action.length; i += 1) {
                    if (!flag) {
                        postId = action[i].post;
                        switch (action[i].action) {
                            case 'repost':
                                actionSum += 0.8;
                                break;
                            case 'comment':
                                actionSum += 0.7;
                                break;
                            case 'attitude':
                                actionSum += 0.2;
                                break;
                            case 'click':
                                actionSum += 0.1;
                                break;
                            default:
                                break;
                        }
                        flag += 1;
                    } else if (String(action[i].post) === String(postId)) {
                        switch (action[i].action) {
                            case 'repost':
                                actionSum += 0.8;
                                break;
                            case 'comment':
                                actionSum += 0.7;
                                break;
                            case 'attitude':
                                actionSum += 0.2;
                                break;
                            case 'click':
                                actionSum += 0.1;
                                break;
                            default:
                                break;
                        }
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
        }
        // 找到最大值
        let weightMax = await Weight.findOne({}).sort('-maxSum');
        let weightArr = await Weight.find({});
        for (let i of weightArr) {
            await Weight.update({_id: i._id}, {point: i.maxSum / weightMax.maxSum})
        }

        /*
         * 第二步：
         *
         * 计算InterAction
         *
         */
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


        /*
         * 第三步：
         *
         * 计算Coupling
         *
         */

        /*
         * 第四步：
         *
         * 计算Similar
         *
         */

        return action;
    } catch (err) {
        console.log(err)
    }


}