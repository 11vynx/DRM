const chiefToken = localStorage.getItem("chiefToken");
if (chiefToken) {
  window.location.href = "check-in.html";
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById("submitBtn");
  const progressBar = document.getElementById("progressBar");
  const progress = document.getElementById("progress");

  submitBtn.disabled = true;
  submitBtn.textContent = "Signing In...";
  progressBar.style.display = "block";
  progress.style.width = "30%";

  const formData = new FormData(e.target);
  const data = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  try {
    progress.style.width = "60%";

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    progress.style.width = "90%";

    const result = await response.json();

    const messageDiv = document.getElementById("message");
    messageDiv.style.display = "block";

    if (response.ok) {
      messageDiv.className = "message success";
      messageDiv.textContent = result.message;

      localStorage.setItem("chiefToken", result.token);

      progress.style.width = "100%";

      setTimeout(() => {
        window.location.href = "check-in.html";
      }, 1000);
    } else {
      messageDiv.className = "message error";
      messageDiv.textContent = result.error;
      progressBar.style.display = "none";
    }
  } catch (error) {
    console.error("Login error:", error);
    const messageDiv = document.getElementById("message");
    messageDiv.style.display = "block";
    messageDiv.className = "message error";
    messageDiv.textContent = "Login failed. Please try again.";
    progressBar.style.display = "none";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign In";
  }
});

document.getElementById("email").focus();
