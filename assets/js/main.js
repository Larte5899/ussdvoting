// === Basic helpers ===
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const byId = (id) => document.getElementById(id);

(function init() {
  const year = byId("year");
  if (year) year.textContent = new Date().getFullYear();

  const copyBtn = byId("copyCodeBtn");
  const codeEl = byId("ussdCodeText");
  if (copyBtn && codeEl) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeEl.textContent.trim());
        copyBtn.innerHTML = '<i class="bi bi-check2"></i> Copied';
        setTimeout(
          () => (copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'),
          1600
        );
      } catch (e) {}
    });
  }

  setupSimulator();
})();

// === USSD Simulator ===
// You can set a live endpoint in the input box.
// If empty, we use a local mock that mirrors your sample PHP logic.
function setupSimulator() {
  const endpointInput = byId("endpointUrl");
  const msisdnInput = byId("msisdnInput");
  const startBtn = byId("startSessionBtn");
  const resetBtn = byId("resetSessionBtn");
  const display = byId("ussdDisplay");
  const replyInput = byId("userReply");
  const sendBtn = byId("sendReplyBtn");
  const sessIdEl = byId("sessId");
  const statusBadge = byId("statusBadge");

  let sessionID = null;
  let userID = null;
  let currentUserData = "";
  let continueSession = false;
  let started = false;

  function setStatus(txt, cls = "bg-secondary") {
    statusBadge.className = `badge ${cls}`;
    statusBadge.textContent = txt;
  }
  function setControls(active) {
    replyInput.disabled = !active;
    sendBtn.disabled = !active;
  }
  function reset() {
    sessionID = userID = null;
    currentUserData = "";
    continueSession = false;
    started = false;
    display.value = "";
    replyInput.value = "";
    sessIdEl.textContent = "—";
    setControls(false);
    setStatus("idle", "bg-secondary");
  }

  resetBtn.addEventListener("click", reset);

  startBtn.addEventListener("click", async () => {
    reset();
    const msisdn = (msisdnInput.value || "").trim() || "233555123456";
    sessionID = Math.random().toString(36).slice(2, 10);
    userID = msisdn;
    sessIdEl.textContent = sessionID;

    const payload = {
      sessionID,
      userID,
      newSession: true,
      msisdn,
      userData: "*928*303#",
      network: "MTN",
    };

    setStatus("connecting…", "bg-info");
    const endpoint = (endpointInput.value || "").trim();

    try {
      const res = endpoint
        ? await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await mockFetch(payload); // local mock

      const data = await res.json();
      handleResponse(data);
      started = true;
      setControls(true);
    } catch (err) {
      setStatus("mock mode", "bg-warning");
      // fall back to mock
      const res = await mockFetch(payload);
      const data = await res.json();
      handleResponse(data);
      started = true;
      setControls(true);
    }
  });

  sendBtn.addEventListener("click", async () => {
    if (!started) return;
    const reply = (replyInput.value || "").trim();
    if (!reply) return;

    currentUserData = reply;
    const payload = {
      sessionID,
      userID,
      newSession: false,
      msisdn: userID,
      userData: currentUserData,
      network: "MTN",
    };

    setStatus("sending…", "bg-info");
    const endpoint = (endpointInput.value || "").trim();

    try {
      const res = endpoint
        ? await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await mockFetch(payload);

      const data = await res.json();
      handleResponse(data);
    } catch (err) {
      setStatus("error → mock", "bg-danger");
      const res = await mockFetch(payload);
      const data = await res.json();
      handleResponse(data);
    } finally {
      replyInput.value = "";
    }
  });

  function handleResponse(data) {
    const out = [
      `message:\n${(data && data.message) || ""}`,
      `\ncontinueSession: ${data && data.continueSession ? "true" : "false"}`,
    ].join("\n");
    display.value = out;
    continueSession = !!(data && data.continueSession);
    setStatus(
      continueSession ? "open" : "closed",
      continueSession ? "bg-success" : "bg-secondary"
    );
    setControls(continueSession);
  }

  // === Local mock that mirrors your PHP sample ===
  function mockFetch(body) {
    const { newSession, userData } = body || {};
    let message = "";
    let cont = false;

    if (newSession && userData === "*928*303#") {
      message = "Welcome to Arkesel Bank\n1. Check Balance\n2. Buy Bundle";
      cont = true;
    } else if (newSession === false && userData === "1") {
      message = "Your account balance is GHc 2.00";
      cont = false;
    } else if (newSession === false && userData === "2") {
      message = "No packages available for subscription";
      cont = false;
    } else {
      message = "Invalid input";
      cont = false;
    }

    const resp = {
      sessionID: body.sessionID,
      userID: body.userID,
      msisdn: body.msisdn,
      message,
      continueSession: cont,
    };

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(resp),
    });
  }
}
