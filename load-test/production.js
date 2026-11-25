import http from 'k6/http';
import { check, sleep } from 'k6';

const WEB = __ENV.WEB_BASE_URL || 'https://38r-seiryofes.com';
const API = __ENV.API_BASE_URL || 'https://api.38r-seiryofes.com';

const MAX_VUS = Number(__ENV.MAX_VUS || 5);
const HOLD_TIME = __ENV.HOLD_TIME || '60s';

if (!Number.isInteger(MAX_VUS) || MAX_VUS < 1 || MAX_VUS > 100) {
  throw new Error('MAX_VUS must be an integer from 1 to 100');
}

function target(rate) {
  return Math.max(1, Math.round(MAX_VUS * rate));
}

export const options = {
  scenarios: {
    production_readonly: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: target(0.1) },
        { duration: '30s', target: target(0.25) },
        { duration: '60s', target: target(0.5) },
        { duration: '60s', target: target(0.75) },
        { duration: '60s', target: MAX_VUS },
        { duration: HOLD_TIME, target: MAX_VUS },
        { duration: '60s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

export function setup() {
  const studentNumber = __ENV.K6_STUDENT_NUMBER;
  const password = __ENV.K6_PASSWORD;

  if (!studentNumber || !password) {
    throw new Error('K6_STUDENT_NUMBER and K6_PASSWORD are required');
  }

  const response = http.post(
    `${API}/api/auth/login`,
    JSON.stringify({
      student_number: studentNumber,
      password,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: {
        endpoint: 'login_setup',
      },
      timeout: '15s',
    },
  );

  const loginOk = check(response, {
    'login succeeded': (r) => r.status === 200,
  });

  if (!loginOk) {
    throw new Error(`Login failed: HTTP ${response.status}`);
  }

  const sessionCookies = response.cookies.session_id || [];
  const session = sessionCookies.find(
    (cookie) => cookie.value && cookie.max_age !== 0
  )?.value;


  if (!session) {
    throw new Error('session_id cookie was not returned');
  }

  return { session };
}

function get(url, session, name) {
  const response = http.get(url, {
    headers: {
      Cookie: `session_id=${session}`,
    },
    tags: {
      endpoint: name,
    },
    timeout: '15s',
  });

  const ok = check(response, {
    [`${name}: HTTP 200`]: (r) => r.status === 200,
  });

  if (!ok) {
    console.warn(
      `[LOAD TEST ERROR] ${name} ` +
      `status=${response.status} ` +
      `server=${response.headers.Server || 'unknown'} ` +
      `cf-ray=${response.headers['Cf-Ray'] || 'unknown'} ` +
      `content-type=${response.headers['Content-Type'] || 'unknown'} ` +
      `body=${String(response.body || '').slice(0, 300)}`
    );
  }

  return response;
}

export default function (data) {
  const today = new Date();
  const future = new Date(today);
  future.setDate(future.getDate() + 30);

  get(WEB, data.session, 'pages_home');

  get(`${API}/health`, data.session, 'worker_health');
  get(`${API}/api/site-config`, data.session, 'site_config');
  get(`${API}/api/site-status`, data.session, 'site_status');
  get(`${API}/api/auth/me`, data.session, 'auth_me');

  get(
    `${API}/api/tasks?scope=class`,
    data.session,
    'tasks_class',
  );

  get(
    `${API}/api/calendar/events?from=${dateString(today)}&to=${dateString(future)}`,
    data.session,
    'calendar_events',
  );

  get(`${API}/api/news`, data.session, 'news_list');
  get(`${API}/api/files?limit=20`, data.session, 'files_list');

  sleep(1 + Math.random() * 2);
}
