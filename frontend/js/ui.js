// UI Components, Toast Notifications, Formatters and Helpers
const UI = {
  toast(type, title, message, duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
      success: 'fa-solid fa-circle-check',
      error: 'fa-solid fa-circle-exclamation',
      warning: 'fa-solid fa-triangle-exclamation',
      info: 'fa-solid fa-circle-info'
    };

    const icon = iconMap[type] || iconMap.info;

    toast.innerHTML = `
      <div class="toast-icon"><i class="${icon}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(message, title = 'Success') {
    this.toast('success', title, message);
  },

  error(message, title = 'Error') {
    this.toast('error', title, message);
  },

  warning(message, title = 'Notice') {
    this.toast('warning', title, message);
  },

  info(message, title = 'Information') {
    this.toast('info', title, message);
  },

  confirm(title, message, confirmText = 'Confirm', isDanger = false) {
    return new Promise((resolve) => {
      let modal = document.getElementById('confirm-modal-dialog');
      if (!modal) {
        modal = document.createElement('dialog');
        modal.id = 'confirm-modal-dialog';
        modal.className = 'modal-dialog';
        modal.innerHTML = `
          <div class="modal-header">
            <h3 class="modal-title" id="confirm-modal-title"></h3>
            <button type="button" class="modal-close" id="confirm-modal-close">&times;</button>
          </div>
          <div class="modal-body" id="confirm-modal-msg"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" id="confirm-modal-cancel">Cancel</button>
            <button type="button" class="btn" id="confirm-modal-ok"></button>
          </div>
        `;
        document.body.appendChild(modal);
      }

      document.getElementById('confirm-modal-title').textContent = title;
      document.getElementById('confirm-modal-msg').textContent = message;

      const okBtn = document.getElementById('confirm-modal-ok');
      okBtn.textContent = confirmText;
      okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

      const cancelBtn = document.getElementById('confirm-modal-cancel');
      const closeBtn = document.getElementById('confirm-modal-close');

      const cleanup = (result) => {
        modal.close();
        resolve(result);
      };

      okBtn.onclick = () => cleanup(true);
      cancelBtn.onclick = () => cleanup(false);
      closeBtn.onclick = () => cleanup(false);

      modal.showModal();
    });
  },

  formatCurrency(amount) {
    const num = Number(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

  initSidebar() {
    const toggleBtn = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('show');
      });
      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target) && sidebar.classList.contains('show')) {
          sidebar.classList.remove('show');
        }
      });
    }
  },

  exportDataToCSV(headers, rows, filename = 'export.csv') {
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  printReceipt() {
    window.print();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  UI.initSidebar();
});
