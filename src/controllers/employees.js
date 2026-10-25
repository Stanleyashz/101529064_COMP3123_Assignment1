const mongoose = require('mongoose');
const logger = require('../lib/logger');
const { validateEmployee } = require('../lib/validation');
const employeeService = require('../services/employees');

function validationError(req, res, errors) {
  logger.warn('validation.employee_failed', {
    ip: req.ip,
    path: req.originalUrl,
    fields: errors.map((item) => item.field),
  });
  return res.status(400).json({
    error: { code: 'VALIDATION_ERROR', message: 'Request data is invalid', details: errors },
  });
}

/**
 * Loads an employee and checks ownership.
 * Returns null after sending a response when the caller must stop:
 *  - 400 when the ID is not a MongoDB ObjectId
 *  - 404 when no employee has that ID
 *  - 403 when the employee exists but belongs to a different user
 */
async function resolveOwnedEmployee(req, res) {
  const { eid } = req.params;
  if (!mongoose.isValidObjectId(eid)) {
    logger.warn('request.invalid_employee_id', { ip: req.ip, path: req.originalUrl });
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid employee id' } });
    return null;
  }

  const employee = await employeeService.findById(eid);
  if (!employee) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    return null;
  }

  if (!employeeService.isOwner(employee, req.userId)) {
    logger.warn('authz.employee_forbidden', {
      ip: req.ip,
      userId: req.userId,
      method: req.method,
      path: req.originalUrl,
      employeeId: eid,
    });
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Employee belongs to another user' } });
    return null;
  }

  return employee;
}

async function list(req, res, next) {
  try {
    const employees = await employeeService.listByOwner(req.userId);
    return res.json({ count: employees.length, employees });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  const { errors, value } = validateEmployee(req.body);
  if (errors.length) return validationError(req, res, errors);

  try {
    const employee = await employeeService.createForOwner(req.userId, value);
    logger.info('employee.created', { userId: req.userId, employeeId: employee.id });
    return res.status(201).json({ message: 'Employee created', employee });
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const employee = await resolveOwnedEmployee(req, res);
    if (!employee) return undefined;
    return res.json({ employee });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  const { errors, value } = validateEmployee(req.body, { partial: true });
  if (errors.length) return validationError(req, res, errors);

  try {
    const employee = await resolveOwnedEmployee(req, res);
    if (!employee) return undefined;

    employee.set(value);
    await employee.save();
    logger.info('employee.updated', { userId: req.userId, employeeId: employee.id });
    return res.json({ message: 'Employee updated', employee });
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  const { eid } = req.query;
  if (!eid || !mongoose.isValidObjectId(eid)) {
    logger.warn('request.invalid_employee_id', { ip: req.ip, path: req.originalUrl });
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'A valid eid query parameter is required' } });
  }

  try {
    const employee = await employeeService.findById(eid);
    if (!employee) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    if (!employeeService.isOwner(employee, req.userId)) {
      logger.warn('authz.employee_forbidden', {
        ip: req.ip,
        userId: req.userId,
        method: req.method,
        path: req.originalUrl,
        employeeId: eid,
      });
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Employee belongs to another user' } });
    }

    await employee.deleteOne();
    logger.info('employee.deleted', { userId: req.userId, employeeId: eid });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, getOne, update, remove };
