const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

const EMPLOYEE_FIELDS = ['first_name', 'last_name', 'email', 'position', 'salary', 'date_of_joining', 'department'];
const USER_FIELDS = ['username', 'email', 'password'];
const TEXT_LIMITS = { first_name: 50, last_name: 50, position: 100, department: 100, email: 254 };
const MAX_SALARY = 1_000_000_000;
const EARLIEST_DATE = Date.UTC(1900, 0, 1);
const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isEmail = (value) => typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value);

function unexpectedFields(body, allowed) {
  return Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map((key) => ({ field: key, message: 'Field is not allowed' }));
}

function validateSignup(body) {
  if (!isPlainObject(body)) return { errors: [{ field: 'body', message: 'Request body must be a JSON object' }], value: {} };

  const errors = unexpectedFields(body, USER_FIELDS);

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (!username) errors.push({ field: 'username', message: 'Username is required' });
  else if (username.length < 3 || username.length > 40) errors.push({ field: 'username', message: 'Username must be 3-40 characters' });
  else if (!USERNAME_PATTERN.test(username)) {
    errors.push({ field: 'username', message: 'Username may only contain letters, numbers, dots, dashes and underscores' });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) errors.push({ field: 'email', message: 'Email is required' });
  else if (!isEmail(email)) errors.push({ field: 'email', message: 'Email must be a valid address' });

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) errors.push({ field: 'password', message: 'Password is required' });
  else if (password.length < 8 || password.length > 72) errors.push({ field: 'password', message: 'Password must be 8-72 characters' });
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must include at least one letter and one number' });
  }

  return { errors, value: { username, email, password } };
}

function validateLogin(body) {
  if (!isPlainObject(body)) return { errors: [{ field: 'body', message: 'Request body must be a JSON object' }], value: {} };

  const errors = [];
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username && !email) errors.push({ field: 'username', message: 'Username or email is required' });
  if (!username && email && !isEmail(email)) errors.push({ field: 'email', message: 'Email must be a valid address' });
  if (!password) errors.push({ field: 'password', message: 'Password is required' });
  else if (password.length > 72) errors.push({ field: 'password', message: 'Password must be 72 characters or fewer' });

  return { errors, value: username ? { username, password } : { email, password } };
}

function validateEmployee(body, { partial = false } = {}) {
  if (!isPlainObject(body)) return { errors: [{ field: 'body', message: 'Request body must be a JSON object' }], value: {} };

  const errors = unexpectedFields(body, EMPLOYEE_FIELDS);
  const keys = Object.keys(body);

  if (partial && keys.length === 0) errors.push({ field: 'body', message: 'At least one field is required' });
  if (!partial) {
    for (const field of EMPLOYEE_FIELDS) {
      if (body[field] === undefined) errors.push({ field, message: `${field} is required` });
    }
  }

  const value = {};
  const readText = (field) => {
    if (body[field] === undefined) return;
    if (typeof body[field] !== 'string') {
      errors.push({ field, message: `${field} must be a string` });
      return;
    }
    const text = body[field].trim();
    if (!text) {
      errors.push({ field, message: `${field} cannot be empty` });
      return;
    }
    if (text.length > TEXT_LIMITS[field]) {
      errors.push({ field, message: `${field} must be at most ${TEXT_LIMITS[field]} characters` });
      return;
    }
    value[field] = field === 'email' ? text.toLowerCase() : text;
  };

  for (const field of ['first_name', 'last_name', 'email', 'position', 'department']) readText(field);
  if (value.email !== undefined && !isEmail(value.email)) errors.push({ field: 'email', message: 'Email must be a valid address' });

  if (body.salary !== undefined) {
    const salary = body.salary;
    if (typeof salary !== 'number' || !Number.isFinite(salary)) errors.push({ field: 'salary', message: 'salary must be a number' });
    else if (salary < 0) errors.push({ field: 'salary', message: 'salary must be zero or greater' });
    else if (salary > MAX_SALARY) errors.push({ field: 'salary', message: `salary must be at most ${MAX_SALARY}` });
    else value.salary = Math.round(salary * 100) / 100;
  }

  if (body.date_of_joining !== undefined) {
    const raw = body.date_of_joining;
    const parsed = typeof raw === 'string' || raw instanceof Date ? new Date(raw) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) errors.push({ field: 'date_of_joining', message: 'date_of_joining must be a valid date' });
    else if (parsed.getTime() < EARLIEST_DATE) errors.push({ field: 'date_of_joining', message: 'date_of_joining is too far in the past' });
    else if (parsed.getTime() > Date.now() + ONE_YEAR_MS) errors.push({ field: 'date_of_joining', message: 'date_of_joining cannot be more than one year in the future' });
    else value.date_of_joining = parsed;
  }

  return { errors, value };
}

module.exports = { validateSignup, validateLogin, validateEmployee, isEmail, EMPLOYEE_FIELDS };
