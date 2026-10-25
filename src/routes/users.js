const router = require('express').Router();
const { signup, login } = require('../controllers/users');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);

module.exports = router;
