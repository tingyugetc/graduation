/**
 * Created by fengyuanzemin on 17/2/15.
 */
import Vue from 'vue';
import Vuex from 'vuex';
import * as actions from './actions';
import * as mutations from './mutations';

Vue.use(Vuex);

const state = {
  isShow: false,
  msg: '出错了',
  isBig: true,
  token: localStorage.getItem('f-token')
};

export default new Vuex.Store({
  state,
  actions,
  mutations
});
