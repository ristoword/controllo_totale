(function () {
  "use strict";

  function initSidebarMobile() {
    var btn = document.getElementById("hamburger-btn");
    var sidebar = document.querySelector(".sidebar");
    var backdrop = document.getElementById("sidebar-backdrop");
    if (!btn || !sidebar) return;

    function setOpen(open) {
      sidebar.classList.toggle("open", open);
      btn.classList.toggle("active", open);
      if (backdrop) backdrop.classList.toggle("visible", open);
      document.body.style.overflow = open ? "hidden" : "";
    }

    function toggle() {
      setOpen(!sidebar.classList.contains("open"));
    }

    btn.addEventListener("click", toggle);
    if (backdrop) backdrop.addEventListener("click", function () { setOpen(false); });

    sidebar.querySelectorAll("a, button").forEach(function (el) {
      el.addEventListener("click", function () {
        if (window.innerWidth <= 720) setOpen(false);
      });
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 720) setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebarMobile);
  } else {
    initSidebarMobile();
  }
})();
