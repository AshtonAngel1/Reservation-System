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

  const reviewsAboutYou = document.getElementById("reviewsAboutYou");
  const reviewTasks = document.getElementById("reviewTasks");

  // Support both ids just in case
  const profilePic =
    document.getElementById("profilePicture") ||
    document.getElementById("profile-picture");

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

  function renderReviews(list, container) {
    container.innerHTML = "";

    if (!list.length) {
      container.innerHTML = "<p>No reviews yet.</p>";
      return;
    }

    list.forEach((review) => {
      const box = document.createElement("div");
      box.className = "reservation-box";
      box.innerHTML = `
        <strong>${review.reviewer_email || "Unknown"}</strong>
        <span> rated you ${review.rating}/5</span>
        <p>${review.comment || "No comment provided."}</p>
        <small>${new Date(review.created_at).toLocaleString()}</small>
      `;
      container.appendChild(box);
    });
  }

  function buildReviewTask(task) {
    const box = document.createElement("div");
    box.className = "reservation-box";

    const title = document.createElement("p");
    title.innerHTML = `<strong>${task.direction_label}</strong> — ${task.item_name || "Reservation"}`;

    const note = document.createElement("p");
    note.textContent = `Target: ${task.review_target_email || "Unknown"}`;

    const ratingInput = document.createElement("input");
    ratingInput.type = "number";
    ratingInput.min = "1";
    ratingInput.max = "5";
    ratingInput.value = "5";

    const commentInput = document.createElement("textarea");
    commentInput.placeholder = "Write your review...";

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Submit Review";

    submitBtn.addEventListener("click", async () => {
      const rating = Number(ratingInput.value);
      const comment = commentInput.value.trim();

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        alert("Rating must be a whole number from 1 to 5");
        return;
      }

      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: task.reservation_id,
          review_target_user_id: task.review_target_user_id,
          rating,
          comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Could not submit review");
        return;
      }

      alert("Review submitted");
      box.remove();
    });

    box.appendChild(title);
    box.appendChild(note);
    box.appendChild(ratingInput);
    box.appendChild(commentInput);
    box.appendChild(submitBtn);

    return box;
  }

  try {
    const [profileRes, reservationsRes, incomingReviewsRes, reviewTasksRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/profile/reservations"),
      fetch("/api/reviews/received"),
      fetch("/api/reviews/pending"),
    ]);

    if (!profileRes.ok) throw new Error("Failed to fetch profile");
    if (!reservationsRes.ok) throw new Error("Failed to fetch reservations");

    const user = await profileRes.json();
    const reservations = await reservationsRes.json();

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

    renderReservations(past, pastList);
    renderReservations(today, todayList);
    renderReservations(future, futureList);

    if (incomingReviewsRes.ok) {
      renderReviews(await incomingReviewsRes.json(), reviewsAboutYou);
    } else {
      reviewsAboutYou.innerHTML = "<p>Could not load reviews.</p>";
    }

    if (reviewTasksRes.ok) {
      const tasks = await reviewTasksRes.json();
      reviewTasks.innerHTML = "";
      if (!tasks.length) {
        reviewTasks.innerHTML = "<p>No pending reviews.</p>";
      } else {
        tasks.forEach((task) => reviewTasks.appendChild(buildReviewTask(task)));
      }
    } else {
      reviewTasks.innerHTML = "<p>Could not load pending reviews.</p>";
    }

    updateBioBtn.addEventListener("click", async () => {
      const newBio = bioInput.value.trim();

      const saveBioRes = await fetch("/api/profile/bio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: newBio }),
      });

      const result = await saveBioRes.json();
      alert(saveBioRes.ok ? "Bio updated" : result.error || "Failed to update bio");
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
