const noticeEl = document.getElementById("notice");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginBlock = document.getElementById("loginBlock");
const registerBlock = document.getElementById("registerBlock");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");

function show(tab) {
  const isLogin = tab === "login";
  loginBlock.classList.toggle("hidden", !isLogin);
  registerBlock.classList.toggle("hidden", isLogin);
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);
  App.setNotice(noticeEl, "");
}

tabLogin.addEventListener("click", () => show("login"));
tabRegister.addEventListener("click", () => show("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const payload = {
      email: formData.get("email"),
      password: formData.get("password")
    };

    const response = await App.api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const target = response.user.role === "admin" ? "/admin" : "/dashboard";
    window.location.href = target;
  } catch (error) {
    App.setNotice(noticeEl, error.message, "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);

  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password !== confirmPassword) {
    App.setNotice(noticeEl, "Пароли не совпадают.", "error");
    return;
  }

  try {
    const payload = {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password
    };

    await App.api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    App.setNotice(noticeEl, "Регистрация успешна. Переходим в личный кабинет.", "success");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 700);
  } catch (error) {
    App.setNotice(noticeEl, error.message, "error");
  }
});

async function bootstrap() {
  const user = await App.getMe();
  App.mountTopbar({ active: "auth", user });

  if (user) {
    window.location.href = user.role === "admin" ? "/admin" : "/dashboard";
  }
}

bootstrap().catch(console.error);
