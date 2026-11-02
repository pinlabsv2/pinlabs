// Endpoint registry. Generated list — add a line when you add an endpoint file.

import core_authLogin from './core/api/authLogin';
import core_authLogout from './core/api/authLogout';
import core_authMe from './core/api/authMe';
import core_authRegister from './core/api/authRegister';
import core_uploadFile from './core/api/uploadFile';
import shop_createOrder from './shop/api/createOrder';
import shop_getMyOrder from './shop/api/getMyOrder';
import shop_getMyOrders from './shop/api/getMyOrders';
import shop_getStorefront from './shop/api/getStorefront';
import shop_myAccount from './shop/api/myAccount';
import shop_track17Webhook from './shop/api/track17Webhook';
import shop_validateDiscount from './shop/api/validateDiscount';
import admin_generateInvoice from './admin/api/generateInvoice';
import admin_getDashboard from './admin/api/getDashboard';
import admin_listOrders from './admin/api/listOrders';
import admin_manageCategories from './admin/api/manageCategories';
import admin_manageCodes from './admin/api/manageCodes';
import admin_manageProducts from './admin/api/manageProducts';
import admin_manageSettings from './admin/api/manageSettings';
import admin_manageSupport from './admin/api/manageSupport';
import admin_refreshTracking from './admin/api/refreshTracking';
import admin_testWallets from './admin/api/testWallets';
import admin_updateOrder from './admin/api/updateOrder';

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
