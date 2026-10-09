const express = require('express');
const { protect, authorize } = require('../middlewares/authMiddleware');
const portal = require('../controllers/portalController');
const publicContent = require('../controllers/publicController');
const multer = require('multer');

const avatarUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_req, file, callback) => callback(null, file.mimetype.startsWith('image/')),
});

const router = express.Router();

router.use(protect);

router.get('/dashboard', portal.getDashboard);
router.get('/plans', portal.listPlans);
router.post('/plans', authorize('admin'), portal.createPlan);
router.post('/plans/seed', authorize('admin'), portal.seedInvestmentPlans);
router.put('/plans/:id', authorize('admin'), portal.updatePlan);
router.delete('/plans/:id', authorize('admin'), portal.deletePlan);

router.get('/investments', portal.listInvestments);
router.post('/investments', portal.createInvestment);
router.get('/portfolio', portal.getPortfolio);
router.get('/transactions', portal.listTransactions);

router.get('/deposit-methods', portal.listDepositMethods);
router.post('/deposit-methods', authorize('admin'), portal.createDepositMethod);
router.put('/deposit-methods/:id', authorize('admin'), portal.updateDepositMethod);
router.get('/deposits', portal.listDeposits);
router.post('/deposits', portal.createDeposit);
router.get('/withdrawals', portal.listWithdrawals);
router.post('/withdrawals', portal.createWithdrawal);

router.patch('/requests/:id/status', authorize('admin'), portal.reviewTransaction);
router.get('/admin/overview', authorize('admin'), portal.getAdminOverview);
router.get('/admin/users', authorize('admin'), portal.listAllUsers);
router.patch('/admin/users/:id/balance', authorize('admin'), portal.adjustInvestorBalance);
router.put('/admin/users/:id', authorize('admin'), portal.updateInvestor);
router.get('/admin/users/:id', authorize('admin'), portal.getAdminUserDetail);
router.get('/admin/transactions', authorize('admin'), portal.listAdminTransactions);
router.get('/admin/investments', authorize('admin'), portal.listAdminInvestments);
router.patch('/admin/investments/:id/status', authorize('admin'), portal.updateAdminInvestmentStatus);
router.put('/admin/site-content', authorize('admin'), publicContent.updatePublicContent);
router.get('/admin/contact-inquiries', authorize('admin'), publicContent.listContactInquiries);
router.put('/settings', portal.updateSettings);
router.post('/settings/avatar', avatarUpload.single('avatar'), portal.uploadAvatar);

module.exports = router;
