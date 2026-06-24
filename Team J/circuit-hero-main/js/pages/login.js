// Login page JavaScript
(function() {
  'use strict';

  // Tab switching
  const tabs = document.querySelectorAll('.login-tab');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
      }
    });
  });

  // Login form submit
  function storeUser(user) {
    localStorage.setItem('ch_username', user.username);
    if (user.email) localStorage.setItem('ch_email', user.email);
    localStorage.setItem('ch_logged_in', 'true');
  }

  async function loadProgressAfterAuth() {
    if (typeof ProgressStore !== 'undefined') {
      await ProgressStore.loadRemoteProgress();
    }
  }

  // Login form submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const result = await ApiClient.login({ username, password });
      storeUser(result.user);
      await loadProgressAfterAuth();
      window.location.href = 'story-map.html';
    } catch (error) {
      alert(error.message);
    }
  });

  // Sign up form submit
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();

    if (!username || !email || !password) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const result = await ApiClient.register({ username, email, password });
      storeUser(result.user);
      await loadProgressAfterAuth();
      window.location.href = 'story-map.html';
    } catch (error) {
      alert(error.message);
    }
  });
})();
