// Endpoint registry. Generated list — add a line when you add an endpoint file.

import core_authLogin from './core/api/authLogin.js';
import core_authLogout from './core/api/authLogout.js';
import core_authMe from './core/api/authMe.js';
import core_authRegister from './core/api/authRegister.js';
import core_uploadFile from './core/api/uploadFile.js';
import shop_createOrder from './shop/api/createOrder.js';
import shop_getMyOrder from './shop/api/getMyOrder.js';
import shop_getMyOrders from './shop/api/getMyOrders.js';
import shop_getStorefront from './shop/api/getStorefront.js';
import shop_myAccount from './shop/api/myAccount.js';
import shop_track17Webhook from './shop/api/track17Webhook.js';
import shop_validateDiscount from './shop/api/validateDiscount.js';
import admin_generateInvoice from './admin/api/generateInvoice.js';
import admin_getDashboard from './admin/api/getDashboard.js';
import admin_listOrders from './admin/api/listOrders.js';
import admin_manageCategories from './admin/api/manageCategories.js';
import admin_manageCodes from './admin/api/manageCodes.js';
import admin_manageProducts from './admin/api/manageProducts.js';
import admin_manageSettings from './admin/api/manageSettings.js';
import admin_manageSupport from './admin/api/manageSupport.js';
import admin_refreshTracking from './admin/api/refreshTracking.js';
import admin_testWallets from './admin/api/testWallets.js';
import admin_updateOrder from './admin/api/updateOrder.js';

export const endpoints = {
  authLogin: { endpoint: core_authLogin, adminOnly: false },
  authLogout: { endpoint: core_authLogout, adminOnly: false },
  authMe: { endpoint: core_authMe, adminOnly: false },
  authRegister: { endpoint: core_authRegister, adminOnly: false },
  uploadFile: { endpoint: core_uploadFile, adminOnly: true },
  createOrder: { endpoint: shop_createOrder, adminOnly: false },
  getMyOrder: { endpoint: shop_getMyOrder, adminOnly: false },
  getMyOrders: { endpoint: shop_getMyOrders, adminOnly: false },
  getStorefront: { endpoint: shop_getStorefront, adminOnly: false },
  myAccount: { endpoint: shop_myAccount, adminOnly: false },
  track17Webhook: { endpoint: shop_track17Webhook, adminOnly: false },
  validateDiscount: { endpoint: shop_validateDiscount, adminOnly: false },
  generateInvoice: { endpoint: admin_generateInvoice, adminOnly: true },
  getDashboard: { endpoint: admin_getDashboard, adminOnly: true },
  listOrders: { endpoint: admin_listOrders, adminOnly: true },
  manageCategories: { endpoint: admin_manageCategories, adminOnly: true },
  manageCodes: { endpoint: admin_manageCodes, adminOnly: true },
  manageProducts: { endpoint: admin_manageProducts, adminOnly: true },
  manageSettings: { endpoint: admin_manageSettings, adminOnly: true },
  manageSupport: { endpoint: admin_manageSupport, adminOnly: true },
  refreshTracking: { endpoint: admin_refreshTracking, adminOnly: true },
  testWallets: { endpoint: admin_testWallets, adminOnly: true },
  updateOrder: { endpoint: admin_updateOrder, adminOnly: true },
};
export type Endpoints = typeof endpoints;
