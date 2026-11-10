document.addEventListener("DOMContentLoaded", async () => {
  const message = document.getElementById("resetMessage");
  const form = document.getElementById("resetForm");
  const saveButton = document.getElementById("savePasswordBtn");
  const passwordInput = document.getElementById("newPassword");
  const confirmInput = document.getElementById("confirmPassword");

  const config = window.CINEVERSE_CONFIG;

  function showMessage(text, success = false) {
    message.textContent = text;
    message.style.color = success ? "#22c55e" : "#f87171";
  }

  function showForm() {
    form.hidden = false;
    showMessage("لینک معتبر است. رمز جدید خود را دو بار وارد کنید.", true);
  }

  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase) {
    showMessage("تنظیمات اتصال کامل نیست. فایل config.js را بررسی کنید.");
    return;
  }

  const client = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey
  );

  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const errorCode = query.get("error_code") || hash.get("error_code");
  const errorDescription =
    query.get("error_description") || hash.get("error_description");

  if (errorCode) {
    showMessage(
      errorCode === "otp_expired"
        ? "این لینک منقضی شده یا قبلاً استفاده شده است. از پنل ورود، لینک بازیابی تازه درخواست کنید."
        : "لینک بازیابی معتبر نیست: " + (errorDescription || errorCode)
    );
    return;
  }

  let recoveryReady = false;

  // این رویداد پس از تأیید لینک بازیابی و ساخت نشست بازیابی ارسال می‌شود.
  const { data: authListener } = client.auth.onAuthStateChange(
    (event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        recoveryReady = true;
        showForm();
      }
    }
  );

  // در حالت PKCE ممکن است نشست پس از پردازش پارامتر code آماده شده باشد.
  const hasRecoveryCallback =
    query.has("code") ||
    query.get("type") === "recovery" ||
    hash.get("type") === "recovery" ||
    hash.has("access_token");

  if (hasRecoveryCallback) {
    const { data, error } = await client.auth.getSession();

    if (!error && data.session) {
      recoveryReady = true;
      showForm();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!recoveryReady) {
      showMessage("نشست بازیابی معتبر نیست. از صفحه ورود، لینک تازه درخواست کنید.");
      return;
    }

    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (password.length < 8) {
      showMessage("رمز باید حداقل ۸ کاراکتر باشد.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("دو رمز واردشده یکسان نیستند.");
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "در حال ذخیره...";

    try {
      const { error } = await client.auth.updateUser({ password });

      if (error) throw error;

      form.reset();
      form.hidden = true;
      showMessage("رمز با موفقیت تغییر کرد. اکنون می‌توانید وارد پنل مدیریت شوید.", true);

      // نشست بازیابی روی همان مرورگر باقی می‌ماند و admin.js آن را بررسی می‌کند.
      window.setTimeout(() => {
        window.location.href = "admin.html";
      }, 1800);
    } catch (error) {
      showMessage("تغییر رمز انجام نشد: " + error.message);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "ذخیره رمز جدید";
    }
  });

  window.addEventListener("pagehide", () => {
    authListener.subscription.unsubscribe();
  });
});
