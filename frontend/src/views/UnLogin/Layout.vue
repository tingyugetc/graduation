<template>
  <div class="container">
    <header>
      <div class="header-title">{{title}}</div>
      <span class="header-right">登录</span>
      <span class="clickBoard clickBoard-right" @click="toLogin"></span>
    </header>
    <keep-alive>
      <component :is="currentView"></component>
    </keep-alive>
    <footer>
      <div class="footer-item" v-for="item in footerItem" @click="checkout(item)">
        <span class="iconfont" :class="item.icon"></span>
        <span class="footer-text">{{item.text}}</span>
      </div>
    </footer>
  </div>
</template>
<script>
  import Index from './Index';
  import Movie from './Movie';

  export default {
    created() {
      if (this.$route.query.component) {
        let i = 0;
        this.footerItem.forEach((item) => {
          if (item.showItem === this.$route.query.component) {
            this.currentView = this.$route.query.component;
          } else {
            i += 1;
          }
        });
        if (i === this.footerItem.length) {
          this.$router.push('/404');
        }
      }
    },
    data() {
      return {
        currentView: 'f-index',
        title: '首页',
        footerItem: [
          {
            icon: 'icon-homepage-red',
            text: '首页',
            showItem: 'f-index'
          },
          {
            icon: 'icon-dianying',
            text: '电影',
            showItem: 'f-movie'
          }
        ]
      };
    },
    watch: {
      '$route'() {
        this.currentView = this.$route.query.component;
      }
    },
    methods: {
      checkout(item) {
        this.$router.push({path: '/un-login', query: {component: item.showItem}});
      },
      toLogin() {
        this.$router.push('/login');
      }
    },
    components: {
      'f-index': Index,
      'f-movie': Movie
    }
  };
</script>
<style lang="scss" scoped>
  .container {
    margin-top: 45px;
    padding-bottom: 49px;
    overflow: auto;
    footer {
      display: flex;
      text-align: center;
      position: fixed;
      bottom: 0;
      width: 100%;
      background-color: #fff;
      border-top: 1px solid #dcdcdc;
      .footer-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        .footer-text {
          color: #333;
          font-size: 14px;
          margin: 5px 0;
        }
        .iconfont {
          color: #555;
          font-size: 20px;
          margin-top: 5px;
          &.footer-plus {
            font-size: 30px;
          }
        }
      }
    }
  }
</style>

