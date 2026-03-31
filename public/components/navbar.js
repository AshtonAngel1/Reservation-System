async function loadNavbar() {
      const response = await fetch("/components/navbar.html");
      const navbarHTML = await response.text();
      document.body.insertAdjacentHTML("afterbegin", navbarHTML);

      const sessionRes = await fetch("/session");
      const sessionData = await sessionRes.json();

      const authSection = document.getElementById("authSection");
      const adminLink = document.getElementById("adminLink");
      const userLinks = document.getElementById("userLinks");

      if (sessionData.loggedIn) {
        authSection.innerHTML = `
          ${sessionData.email}
          <button onclick="logout()">Logout</button>
        `;

        userLinks.style.display = "inline";

        if (sessionData.is_admin) {
          adminLink.style.display = "inline-block";
        }

        if (sessionData.is_staff) {
          document.getElementById("staffLink").style.display = "inline-block";
        }

      } else {
        authSection.innerHTML = `
          <a href="/login.html" style="color:white;">Login</a>
        `;
      }
    }

    async function logout() {
      await fetch("/logout", { method: "POST" });
      window.location.href = "/";
    }

    loadNavbar();