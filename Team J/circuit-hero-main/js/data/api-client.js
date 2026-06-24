// Small API wrapper for the local Express backend.
const ApiClient = (function() {
  async function request(url, options) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json'
      },
      ...options
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      var message = body && body.error ? body.error : 'Request failed';
      throw new Error(message);
    }
    return body;
  }

  function register(payload) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  function login(payload) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  function me() {
    return request('/api/me', { method: 'GET' });
  }

  function getProgress() {
    return request('/api/progress', { method: 'GET' });
  }

  function saveProgress(payload) {
    return request('/api/progress', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  return {
    register: register,
    login: login,
    me: me,
    getProgress: getProgress,
    saveProgress: saveProgress
  };
})();
