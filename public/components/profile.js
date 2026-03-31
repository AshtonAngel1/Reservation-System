document.addEventListener("DOMContentLoaded", async () => {
  const bioInput = document.getElementById("bioInput");
  const updateBioBtn = document.getElementById("updateBioBtn");

  const updatePictureBtn = document.getElementById("updatePictureBtn");
  const profilePictureUrl = document.getElementById("profilePictureUrl");

  const pastList = document.getElementById("pastReservations");
  const todayList = document.getElementById("todayReservations");
  const futureList = document.getElementById("futureReservations");

  const userEmail = document.getElementById("userEmail");
  const userId = document.getElementById("userId");

  // Support both ids just in case
  const profilePic =
    document.getElementById("profilePicture") ||
    document.getElementById("profile-picture");

  try {
    const res = await fetch("/api/profile");
    if (!res.ok) throw new Error("Failed to fetch profile");

    const user = await res.json();

    // fetch reservations (flat list from backend)
    const resReservations = await fetch("/api/profile/reservations");
    if (!resReservations.ok) throw new Error("Failed to fetch reservations");

    const reservations = await resReservations.json();

    // split reservations on frontend
    const now = new Date();
    const past = [];
    const today = [];
    const future = [];

    reservations.forEach((r) => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);

      if (end < now) past.push(r);
      else if (start <= now && end >= now) today.push(r);
      else future.push(r);
    });

    // populate profile
    userEmail.textContent = user.email;
    userId.textContent = user.id;
    bioInput.value = user.bio || "";

    if (user.profile_picture && user.profile_picture !== "") {
      profilePic.src = user.profile_picture;
      if (profilePictureUrl) profilePictureUrl.value = user.profile_picture;
    } else {
      profilePic.src = "/components/profile-pic.png";
    }

    function renderReservations(list, container) {
      container.innerHTML = "";

      if (!list.length) {
        container.innerHTML = "<li>No reservations</li>";
        return;
      }

      list.forEach((r) => {
        const li = document.createElement("li");
        li.textContent = `${r.item_name} (${r.item_type}) ${new Date(
          r.start_date
        ).toLocaleString()} → ${new Date(r.end_date).toLocaleString()}`;
        container.appendChild(li);
      });
    }

    renderReservations(past, pastList);
    renderReservations(today, todayList);
    renderReservations(future, futureList);

    updateBioBtn.addEventListener("click", async () => {
      const newBio = bioInput.value.trim();

      const saveBioRes = await fetch("/api/profile/bio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: newBio }),
      });

      const result = await saveBioRes.json();
      alert(saveBioRes.ok ? "Bio updated" : (result.error || "Failed to update bio"));
    });

    if (updatePictureBtn) {
      updatePictureBtn.addEventListener("click", async () => {
        const url = (profilePictureUrl?.value || "").trim();
        if (!url) {
          alert("Please enter an image URL");
          return;
        }

        const picRes = await fetch("/api/profile/picture", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile_picture: url }),
        });

        const result = await picRes.json();

        if (picRes.ok) {
          profilePic.src = url;
          alert("Profile picture updated");
        } else {
          alert(result.error || "Failed to update profile picture");
        }
      });
    }
  } catch (err) {
    console.error(err);
    alert("Error loading profile");
  }
});
