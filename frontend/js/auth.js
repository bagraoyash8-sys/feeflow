// FeeFlow Authentication & Route Guard
const Auth = {
  checkGuard(requiredRole) {
    const token = API.getToken();
    const user = API.getUser();

    if (!token || !user) {
      window.location.href = '/login.html';
      return false;
    }

    if (requiredRole && user.role !== requiredRole) {
      if (user.role === 'admin') {
        window.location.href = '/pages/admin/dashboard.html';
      } else {
        window.location.href = '/pages/student/dashboard.html';
      }
      return false;
    }

    this.renderUserBadge(user);
    return true;
  },

  renderUserBadge(user) {
    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');
    const avatarEl = document.querySelector('.user-avatar');

    if (nameEl) nameEl.textContent = user.name || user.email;
    if (roleEl) roleEl.textContent = user.role === 'admin' ? 'Administrator' : 'Student';
    if (avatarEl) {
      const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
      avatarEl.textContent = initial;
    }
  },

  logout() {
    API.clearSession();
    window.location.href = '/login.html';
  },

  initLoginForm() {
    const adminTab = document.getElementById('tab-admin');
    const studentTab = document.getElementById('tab-student');
    const adminForm = document.getElementById('form-admin-login');
    const studentForm = document.getElementById('form-student-login');

    if (adminTab && studentTab) {
      adminTab.addEventListener('click', () => {
        adminTab.classList.add('active');
        studentTab.classList.remove('active');
        adminForm.style.display = 'block';
        studentForm.style.display = 'none';
      });

      studentTab.addEventListener('click', () => {
        studentTab.classList.add('active');
        adminTab.classList.remove('active');
        studentForm.style.display = 'block';
        adminForm.style.display = 'none';
      });
    }

    if (adminForm) {
      adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value.trim();
        const password = document.getElementById('admin-password').value;
        const btn = adminForm.querySelector('button[type="submit"]');

        if (!email || !password) {
          UI.error('Please enter both email and password');
          return;
        }

        try {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner"></span> Signing in...';
          const res = await API.post('/auth/login', {
            identifier: email,
            password,
            role: 'admin'
          });

          API.setToken(res.data.token);
          API.setUser(res.data.user);
          UI.success('Welcome back, ' + (res.data.user.name || 'Admin'));
          setTimeout(() => {
            window.location.href = '/pages/admin/dashboard.html';
          }, 800);
        } catch (err) {
          UI.error(err.message || 'Incorrect login credentials');
        } finally {
          btn.disabled = false;
          btn.innerHTML = 'Sign In as Administrator';
        }
      });
    }

    if (studentForm) {
      studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roll = document.getElementById('student-roll').value.trim();
        const password = document.getElementById('student-password').value;
        const btn = studentForm.querySelector('button[type="submit"]');

        if (!roll || !password) {
          UI.error('Please enter roll number and password');
          return;
        }

        try {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner"></span> Signing in...';
          const res = await API.post('/auth/login', {
            identifier: roll,
            password,
            role: 'student'
          });

          API.setToken(res.data.token);
          API.setUser(res.data.user);
          UI.success('Welcome, ' + (res.data.user.name || 'Student'));
          setTimeout(() => {
            window.location.href = '/pages/student/dashboard.html';
          }, 800);
        } catch (err) {
          UI.error(err.message || 'Incorrect roll number or password');
        } finally {
          btn.disabled = false;
          btn.innerHTML = 'Sign In as Student';
        }
      });
    }
  }
};
