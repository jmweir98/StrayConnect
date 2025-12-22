// === Azure Logic App endpoints & storage account ===
const CREATE_URL = "https://prod-18.switzerlandnorth.logic.azure.com:443/workflows/939b1fafd49244f197e95f211d8f5344/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=l08bYiIwxVJ_f5ot_S_S5A2O6jDrLUQHiHTj3BCf4gI";
const GETALL_URL = "https://prod-15.switzerlandnorth.logic.azure.com:443/workflows/8c8fd8f17cc44716bf123ecf1a433a95/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=Kl85CdlAdHaVfFpGUS13uChrHkrLSrgF1_fUaYV-SP0";
const UPDATE_URL = "https://prod-31.switzerlandnorth.logic.azure.com:443/workflows/d45818567cdf47d8a23f54ebfd31275e/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=GlKqg4n08ZZj_cwe_ommOjvvLPVLINI-70GvacT6Ahg";
const DELETE_URL = "https://prod-05.switzerlandnorth.logic.azure.com:443/workflows/478ff23130074d8b84150cb363b52a35/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=DnKzpI0DiyNMGklEqZt-iqijD4PJ9SuevZoJARgKQ5A";

// === Blob account endpoint ===
const BLOB_ACCOUNT = "https://petblobstorev2.blob.core.windows.net";

// === jQuery handlers ===
$(document).ready(function () {
  // Check if user is logged in
  const userName = localStorage.getItem('strayconnect_userName');
  const userID = localStorage.getItem('strayconnect_userID');
  const isAdmin = localStorage.getItem('strayconnect_isAdmin') === 'true';
  
  if (!userName || !userID) {
    window.location.href = 'login.html';
    return;
  }
  
  // Auto-fill user fields
  $('#userName').val(userName);
  $('#userID').val(userID);

  $("#retImages").click(getImages);
  $("#subNewForm").click(submitNewAsset);
  $("#logoutBtn").click(() => {
    localStorage.removeItem('strayconnect_userName');
    localStorage.removeItem('strayconnect_userID');
    localStorage.removeItem('strayconnect_isAdmin');
    window.location.href = 'login.html';
  });

  // buttons added dynamically inside cards
  $(document).on("click", ".btn-delete", handleDelete);
  $(document).on("click", ".btn-update", handleUpdate);
});

// === Upload new asset (CREATE) ===
// IMPORTANT: use the SAME multipart keys as your Postman test
function submitNewAsset() {
  const submitData = new FormData();

  // match Postman keys EXACTLY (case-sensitive)
  submitData.append("fileName", $("#FileName").val());     // UI field id is FileName; key must be fileName
  submitData.append("UserID", $("#userID").val());         // Postman used UserID (capital U)
  submitData.append("userName", $("#userName").val());

  // Optional fields: if your HTML doesn't have these ids, blanks are sent (safe)
  submitData.append("location", $("#location").val() || "");
  submitData.append("description", $("#description").val() || "");
  submitData.append("status", $("#status").val() || "");
  submitData.append("petType", $("#petType").val() || "");

  submitData.append("File", $("#UpFile")[0].files[0]);     // Postman used File

  $.ajax({
    url: CREATE_URL,
    data: submitData,
    cache: false,
    enctype: "multipart/form-data",
    contentType: false,
    processData: false,
    type: "POST",
    success: (data) => {
      console.log("Upload response:", data);
      getImages();
    },
    error: (xhr, status, err) => {
      console.error("Upload failed:", status, err, xhr?.responseText);
      alert("Upload failed — see console for details.");
    },
  });
}

// === Retrieve and render media list (GET ALL) ===
function getImages() {
  const $list = $("#ImageList");
  const isAdmin = localStorage.getItem('strayconnect_isAdmin') === 'true';
  $list
    .addClass("media-grid")
    .html('<div class="spinner-border" role="status"><span>Loading...</span></div>');

  $.ajax({
    url: GETALL_URL,
    type: "GET",
    dataType: "json",
    success: function (data) {
      console.log("Raw data received:", data);

      // Your Logic App returns: { "Documents": [ ... ] }
      const items =
        Array.isArray(data) ? data :
        Array.isArray(data.Documents) ? data.Documents :
        Array.isArray(data.documents) ? data.documents :
        Array.isArray(data.body) ? data.body :
        Array.isArray(data.value) ? data.value :
        [];

      if (!Array.isArray(items) || items.length === 0) {
        $list.html("<p>No media found.</p>");
        return;
      }

      let videoCounter = 0;
      const cards = [];

      // IMPORTANT: loop items (not data)
      $.each(items, function (_, val) {
        try {
          // REQUIRED FOR UPDATE/DELETE
          const id = unwrapMaybeBase64(val.id || val.Id || "");
          const pk = unwrapMaybeBase64(val.pk || val.Pk || val.PK || "");

          const filePath = unwrapMaybeBase64(val.filePath || val.FilePath || "");
          const fileLocator = unwrapMaybeBase64(val.fileLocator || val.FileLocator || "");

          // DISPLAY FIELDS (support both casing styles)
          const fileName = unwrapMaybeBase64(val.fileName || val.FileName || "");
          const userName = unwrapMaybeBase64(val.userName || val.UserName || "");
          const userID = unwrapMaybeBase64(val.userID || val.UserID || val.UserId || "");
          const petType = unwrapMaybeBase64(val.petType || val.PetType || "");
          const status = unwrapMaybeBase64(val.status || val.Status || "");
          const location = unwrapMaybeBase64(val.location || val.Location || "");
          const description = unwrapMaybeBase64(val.description || val.Description || "");
          const contentType = val.contentType || val.ContentType || "";

          const fullUrl = buildBlobUrl(filePath);
          const isVideo = isLikelyVideo({ contentType, url: fullUrl, fileName });

          // store required values on card for update/delete
          const cardAttrs = `
            data-id="${escapeAttr(id)}"
            data-pk="${escapeAttr(pk)}"
            data-filepath="${escapeAttr(filePath)}"
            data-filelocator="${escapeAttr(fileLocator)}"
            data-filename="${escapeAttr(fileName)}"
            data-username="${escapeAttr(userName)}"
            data-userid="${escapeAttr(userID)}"
            data-pettype="${escapeAttr(petType)}"
            data-status="${escapeAttr(status)}"
            data-location="${escapeAttr(location)}"
            data-description="${escapeAttr(description)}"
          `;

          if (isVideo) {
            videoCounter += 1;
            const label = `video${videoCounter}`;

            cards.push(`
              <div class="media-card" ${cardAttrs}>
                <div class="media-thumb">
                  <a class="video-link" href="${fullUrl}" target="_blank" download="${escapeAttr(fileName || label)}">${label}</a>
                </div>
                <div class="media-body">
                  <span class="media-title">${escapeHtml(fileName || "(unnamed)")}</span>
                  <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
                  <div>Pet Type: ${escapeHtml(petType || "(unknown)")}</div>
                  <div>Status: ${escapeHtml(status || "(unknown)")}</div>
                  <div>Location: ${escapeHtml(location || "(unknown)")}</div>
                  <div>Description: ${escapeHtml(description || "(no description)")}</div>
                  <div class="media-actions">
                    <button class="btn btn-sm btn-outline-primary btn-update">Update</button>
                    ${isAdmin ? '<button class="btn btn-sm btn-outline-danger btn-delete">Delete</button>' : ''}
                  </div>
                </div>
              </div>
            `);
          } else {
            const safeLabel = escapeHtml(fileName || fullUrl);

            cards.push(`
              <div class="media-card" ${cardAttrs}>
                <div class="media-thumb">
                  <img src="${fullUrl}"
                       alt="${safeLabel}"
                       onerror="imageFallbackToLink(this, '${fullUrl.replace(/'/g,"\\'")}', '${safeLabel.replace(/'/g,"\\'")}')" />
                </div>
                <div class="media-body">
                  <span class="media-title">${safeLabel}</span>
                  <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
                  <div>Pet Type: ${escapeHtml(petType || "(unknown)")}</div>
                  <div>Status: ${escapeHtml(status || "(unknown)")}</div>
                  <div>Location: ${escapeHtml(location || "(unknown)")}</div>
                  <div>Description: ${escapeHtml(description || "(no description)")}</div>
                  <div class="media-actions">
                    <button class="btn btn-sm btn-outline-primary btn-update">Update</button>
                    ${isAdmin ? '<button class="btn btn-sm btn-outline-danger btn-delete">Delete</button>' : ''}
                  </div>
                  <div class="image-error"></div>
                </div>
              </div>
            `);
          }
        } catch (err) {
          console.error("Error building card:", err, val);
          cards.push(`
            <div class="media-card">
              <div class="media-body">
                <span class="media-title" style="color:#b91c1c;">Error displaying this item</span>
              </div>
            </div>
          `);
        }
      });

      $list.html(cards.join(""));
    },
    error: (xhr, status, error) => {
      console.error("Error fetching media:", status, error, xhr?.responseText);
      $list.html("<p style='color:red;'>Error loading media. Check console.</p>");
    },
  });
}

// === DELETE (POST-as-delete) ===
function handleDelete() {
  const $card = $(this).closest(".media-card");

  const payload = {
    id: $card.data("id"),
    pk: $card.data("pk"),
    filePath: $card.data("filepath"),
  };

  if (!payload.id || !payload.pk || !payload.filePath) {
    alert("Missing id/pk/filePath — cannot delete.");
    return;
  }

  $.ajax({
    url: DELETE_URL,
    type: "POST", // keep POST if your Logic App trigger is POST
    contentType: "application/json",
    data: JSON.stringify(payload),
    success: (data) => {
      console.log("Delete response:", data);
      getImages();
    },
    error: (xhr, status, err) => {
      console.error("Delete failed:", status, err, xhr?.responseText);
      alert("Delete failed — see console for details.");
    },
  });
}

// === UPDATE (Replace document) ===
function handleUpdate() {
  const $card = $(this).closest(".media-card");
  showUpdateForm($card);
}

function showUpdateForm($card) {
  const modal = `
    <div id="updateModal" class="modal" style="display:block; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.5);">
      <div class="modal-content" style="background:#fff; margin:15% auto; padding:20px; border:1px solid #888; width:400px; border-radius:8px;">
        <span class="close" style="color:#aaa; float:right; font-size:28px; font-weight:bold; cursor:pointer;">&times;</span>
        <h3>Update Media</h3>
        <form id="updateForm">
          <div style="margin-bottom:15px;">
            <label>Status:</label><br>
            <input type="text" id="updateStatus" value="${$card.data('status') || 'found'}" style="width:100%; padding:8px; margin-top:5px;">
          </div>
          <div style="margin-bottom:15px;">
            <label>Location:</label><br>
            <input type="text" id="updateLocation" value="${$card.data('location') || 'Moy'}" style="width:100%; padding:8px; margin-top:5px;">
          </div>
          <div style="margin-bottom:15px;">
            <label>Pet Type:</label><br>
            <input type="text" id="updatePetType" value="${$card.data('pettype') || 'dog'}" style="width:100%; padding:8px; margin-top:5px;">
          </div>
          <div style="margin-bottom:15px;">
            <label>Description:</label><br>
            <textarea id="updateDescription" style="width:100%; padding:8px; margin-top:5px; height:80px;">${$card.data('description') || 'Updated via UI'}</textarea>
          </div>
          <div style="text-align:right;">
            <button type="button" id="cancelUpdate" style="margin-right:10px; padding:8px 16px;">Cancel</button>
            <button type="submit" style="padding:8px 16px; background:#007bff; color:white; border:none; border-radius:4px;">Update</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  $('body').append(modal);
  
  $('#updateModal .close, #cancelUpdate').click(() => $('#updateModal').remove());
  
  $('#updateForm').submit(function(e) {
    e.preventDefault();
    
    const payload = {
      id: $card.data("id"),
      pk: $card.data("pk"),
      filePath: $card.data("filepath"),
      fileLocator: $card.data("filelocator"),
      fileName: $card.data("filename") || "updated.jpg",
      petType: $('#updatePetType').val(),
      status: $('#updateStatus').val(),
      location: $('#updateLocation').val(),
      description: $('#updateDescription').val(),
      userID: $card.data("userid") || $card.data("pk"),
      userName: $card.data("username") || "Updated user",
    };

    if (!payload.id || !payload.pk || !payload.filePath || !payload.fileLocator) {
      alert("Missing required fields — cannot update.");
      return;
    }

    $.ajax({
      url: UPDATE_URL,
      type: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify(payload),
      success: (data) => {
        console.log("Update response:", data);
        $('#updateModal').remove();
        getImages();
      },
      error: (xhr, status, err) => {
        console.error("Update failed:", status, err, xhr?.responseText);
        alert("Update failed — see console for details.");
      },
    });
  });
}

// === Helpers ===
function unwrapMaybeBase64(value) {
  if (value && typeof value === "object" && "$content" in value) {
    try { return atob(value.$content); } catch { return value.$content || ""; }
  }
  return value || "";
}

function buildBlobUrl(filePath) {
  if (!filePath) return "";
  const trimmed = String(filePath).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const left = (BLOB_ACCOUNT || "").replace(/\/+$/g, "");
  const right = trimmed.replace(/^\/+/g, "");
  return `${left}/${right}`;
}

function isLikelyVideo({ contentType, url, fileName }) {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  const target = ((url || "") + " " + (fileName || "")).toLowerCase();
  return /\.(mp4|m4v|webm|og[gv]|mov|avi)(\?|#|$)/.test(target);
}

function imageFallbackToLink(imgEl, url, label) {
  const card = imgEl.closest(".media-card");
  if (!card) return;
  const thumb = card.querySelector(".media-thumb");
  const errMsg = card.querySelector(".image-error");

  if (thumb) {
    thumb.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="video-link">${label || url}</a>`;
  }
  if (errMsg) {
    errMsg.textContent = "Image failed to load — opened as link instead.";
    errMsg.style.display = "block";
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
