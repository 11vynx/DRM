document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".nav-link");

function setActiveLink() {
  let current = "";
  sections.forEach((section) => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;
    if (window.pageYOffset >= sectionTop - 200) {
      current = section.getAttribute("id");
    }
  });

  navLinks.forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("href") === `#${current}`) {
      link.classList.add("active");
    }
  });
}

window.addEventListener("scroll", setActiveLink);

const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");

if (hamburger) {
  hamburger.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    hamburger.classList.toggle("active");
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("active");
      hamburger.classList.remove("active");
    });
  });
}

const contactForm = document.getElementById("contactForm");

if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      subject: document.getElementById("subject").value,
      message: document.getElementById("message").value,
    };

    console.log("Form submitted:", formData);

    showNotification(
      "Thank you for your message! We will get back to you soon.",
      "success"
    );

    contactForm.reset();
  });
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${getNotificationIcon(type)}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;

  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  const closeBtn = notification.querySelector(".notification-close");
  closeBtn.addEventListener("click", () => {
    notification.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => notification.remove(), 300);
  });

  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.style.animation = "slideOut 0.3s ease-out";
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

function getNotificationIcon(type) {
  const icons = {
    success: "[SUCCESS]",
    error: "[ERROR]",
    warning: "[WARNING]",
    info: "[INFO]",
  };
  return icons[type] || icons.info;
}

const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  .notification-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .notification-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .notification-message {
    flex: 1;
    color: #333;
    line-height: 1.5;
  }

  .notification-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #718096;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .notification-close:hover {
    background: #f8f9fa;
  }

  .notification-success .notification-icon {
    color: #48bb78;
  }

  .notification-error .notification-icon {
    color: #f56565;
  }

  .notification-warning .notification-icon {
    color: #ed8936;
  }

  .notification-info .notification-icon {
    color: #4299e1;
  }

 
  @media (max-width: 768px) {
    .nav-menu {
      position: fixed;
      left: -100%;
      top: 80px;
      flex-direction: column;
      background: white;
      width: 100%;
      text-align: center;
      transition: 0.3s;
      box-shadow: 0 10px 27px rgba(0, 0, 0, 0.05);
      padding: 2rem 0;
      gap: 1rem;
    }

    .nav-menu.active {
      left: 0;
    }

    .hamburger.active span:nth-child(1) {
      transform: rotate(-45deg) translate(-5px, 6px);
    }

    .hamburger.active span:nth-child(2) {
      opacity: 0;
    }

    .hamburger.active span:nth-child(3) {
      transform: rotate(45deg) translate(-5px, -6px);
    }
  }
`;
document.head.appendChild(style);

const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -100px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.animation = "fadeInUp 0.6s ease-out forwards";
    }
  });
}, observerOptions);

const fadeInStyle = document.createElement("style");
fadeInStyle.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .training-card,
  .news-card,
  .advisory-card,
  .mv-card {
    opacity: 0;
  }
`;
document.head.appendChild(fadeInStyle);

document.addEventListener("DOMContentLoaded", () => {
  const animatedElements = document.querySelectorAll(
    ".training-card, .news-card, .advisory-card, .mv-card"
  );
  animatedElements.forEach((el) => observer.observe(el));
});

const trainingButtons = document.querySelectorAll(".btn-training");
trainingButtons.forEach((button) => {
  button.addEventListener("click", (e) => {
    e.preventDefault();
    const trainingTitle = button
      .closest(".training-card")
      .querySelector("h3").textContent;
    showNotification(
      `Registration form for "${trainingTitle}" will be available soon!`,
      "info"
    );
  });
});

const readMoreButtons = document.querySelectorAll(".read-more");
readMoreButtons.forEach((button) => {
  button.addEventListener("click", (e) => {
    e.preventDefault();
    const newsTitle = button
      .closest(".news-card")
      .querySelector("h3").textContent;
    showNotification(
      `Full story for "${newsTitle}" will be available soon!`,
      "info"
    );
  });
});

window.addEventListener("scroll", () => {
  const navbar = document.querySelector(".navbar");
  if (window.scrollY > 100) {
    navbar.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
  } else {
    navbar.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
  }
});

console.log(
  "%cProject DRM",
  "color: #1a365d; font-size: 24px; font-weight: bold;"
);
console.log(
  "%cDisaster Response & Emergency Action Management System",
  "color: #4299e1; font-size: 14px;"
);
console.log("%cPDRRMO South Cotabato", "color: #718096; font-size: 12px;");
console.log("\nThis is a prototype landing page for demonstration purposes.");
