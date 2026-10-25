const router = require('express').Router();
const authenticate = require('../middleware/auth');
const employees = require('../controllers/employees');

router.use(authenticate);

router.get('/employees', employees.list);
router.post('/employees', employees.create);
router.get('/employees/:eid', employees.getOne);
router.put('/employees/:eid', employees.update);
router.delete('/employees', employees.remove);

module.exports = router;
