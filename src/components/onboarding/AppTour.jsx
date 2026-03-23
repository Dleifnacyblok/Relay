import { useState, useCallback, useEffect, useRef } from "react";
import Joyride, { STATUS, EVENTS, ACTIONS } from "react-joyride";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const tourSteps = [
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "Welcome to Relay Loaner Manager",
    content: (
      <div className="space-y-2 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          This quick tour will walk you through the key features of the app so you can hit the ground running.
        </p>
        <p className="text-gray-500 text-xs">Click <strong>Next</strong> to begin, or <strong>Skip</strong> to explore on your own.</p>
      </div>
    ),
    page: null,
  },
  // ── MY LOANERS ──
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "📦 My Loaners — Overview",
    content: (
      <div className="space-y-2 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          <strong>My Loaners</strong> is your personal dashboard for all loaner sets currently assigned to you or your accounts.
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc ml-4">
          <li>See which sets are <span className="text-red-600 font-medium">overdue</span> and accumulating fines</li>
          <li>Track sets <span className="text-amber-600 font-medium">due within 7 days</span></li>
          <li>View <span className="font-medium">fine amounts</span> per loaner in real time</li>
        </ul>
      </div>
    ),
    page: "MyLoaners",
  },
  {
    target: "[data-tour='loaners-search']",
    placement: "bottom",
    disableBeacon: true,
    title: "🔍 Search Your Loaners",
    content: (
      <div className="space-y-1 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          Quickly filter your loaners by <strong>set name</strong>, <strong>account</strong>, <strong>rep</strong>, or <strong>Etch ID</strong>.
          Results update instantly as you type.
        </p>
      </div>
    ),
    page: "MyLoaners",
  },
  {
    target: "[data-tour='loaners-stats']",
    placement: "bottom",
    disableBeacon: true,
    title: "📊 Status Summary",
    content: (
      <div className="space-y-1 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          At a glance, see your <strong>total loaners</strong>, how many are <strong>overdue</strong>, <strong>due soon</strong>, and your <strong>total fine exposure</strong>.
          Tap any stat card to filter the list below it.
        </p>
      </div>
    ),
    page: "MyLoaners",
  },
  {
    target: "[data-tour='loaners-actions']",
    placement: "top",
    disableBeacon: true,
    title: "⚡ Bulk Actions",
    content: (
      <div className="space-y-1 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          Select one or more loaners to unlock bulk actions:
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc ml-4">
          <li><strong>Send Back</strong> — log a return with tracking number & photos</li>
          <li><strong>Transfer</strong> — reassign to another rep with a request number</li>
          <li><strong>Sync to Calendar</strong> — push due dates to Google Calendar</li>
          <li><strong>Export PDF</strong> — generate a formatted summary report</li>
        </ul>
      </div>
    ),
    page: "MyLoaners",
  },
  // ── MISSING PARTS ──
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "⚠️ Missing Parts — Overview",
    content: (
      <div className="space-y-2 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          <strong>Missing Parts</strong> tracks individual components that have gone missing from loaner sets.
          Each missing part can carry a fine, and you can manage their lifecycle here.
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc ml-4">
          <li>View all parts reported as <span className="text-red-600 font-medium">missing</span></li>
          <li>Mark parts as <span className="text-green-600 font-medium">found</span> or <span className="text-blue-600 font-medium">paid</span></li>
          <li>Track fine amounts and deduction dates</li>
        </ul>
      </div>
    ),
    page: "MyMissingParts",
  },
  {
    target: "[data-tour='missing-parts-table']",
    placement: "top",
    disableBeacon: true,
    title: "📋 Parts List",
    content: (
      <div className="space-y-1 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          Each row shows the <strong>part name</strong>, <strong>part number</strong>, associated <strong>loaner set</strong>, <strong>fine amount</strong>, and current <strong>status</strong>.
          Use the status dropdown on each row to update it in real time.
        </p>
      </div>
    ),
    page: "MyMissingParts",
  },
  // ── MARKETPLACE ──
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "🛍️ Marketplace — Overview",
    content: (
      <div className="space-y-2 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          The <strong>Marketplace</strong> is a peer-to-peer exchange where reps can list spare parts they have available and discover parts they need.
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc ml-4">
          <li>Post items you have available for other reps</li>
          <li>Browse parts listed by your colleagues</li>
          <li>Submit bids/requests on items you need</li>
          <li>Use <strong>AI photo identification</strong> to find part numbers</li>
        </ul>
      </div>
    ),
    page: "Marketplace",
  },
  {
    target: "[data-tour='marketplace-list']",
    placement: "top",
    disableBeacon: true,
    title: "📦 Available Items",
    content: (
      <div className="space-y-1 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          Browse all items listed as <strong>Available</strong>. Click any card to view details, see photos, and place a request.
          Items move to <em>Pending</em> once a bid is placed.
        </p>
      </div>
    ),
    page: "Marketplace",
  },
  {
    target: "[data-tour='marketplace-looking-for']",
    placement: "top",
    disableBeacon: true,
    title: "🔎 Looking For",
    content: (
      <div className="space-y-1 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          Post a <strong>"Looking For"</strong> request when you need a specific part. Other reps will see your request and can reach out.
          You can upload a photo and the AI will attempt to identify the part number automatically.
        </p>
      </div>
    ),
    page: "Marketplace",
  },
  // ── TRACK LOG ──
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "📝 Track Log — Overview",
    content: (
      <div className="space-y-2 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          The <strong>Track Log</strong> is a full audit trail of every return and transfer you've logged in the system.
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc ml-4">
          <li>View past <strong>Send Back</strong> entries with tracking numbers</li>
          <li>Review <strong>Transfer</strong> records with request numbers</li>
          <li>Access linked <strong>photos</strong> and notes from each submission</li>
        </ul>
      </div>
    ),
    page: "SendBackLog",
  },
  {
    target: "[data-tour='tracklog-entries']",
    placement: "top",
    disableBeacon: true,
    title: "🗂️ Log Entries",
    content: (
      <div className="space-y-1 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          Each entry shows the <strong>date</strong>, <strong>tracking/request number</strong>, the sets involved, and any attached photos.
          Entries are sorted newest first and include a <strong>type badge</strong> (Send Back vs Transfer).
        </p>
      </div>
    ),
    page: "SendBackLog",
  },
  // ── MY ACCOUNT ──
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "👤 My Account — Overview",
    content: (
      <div className="space-y-2 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          <strong>My Account</strong> is your personal hub — see all your metrics at a glance and manage your settings.
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc ml-4">
          <li>View <strong>total fines</strong> broken down by loaners and missing parts</li>
          <li>Manage your <strong>assigned accounts</strong></li>
          <li>Update your <strong>notification preferences</strong></li>
          <li>Re-run the <strong>profile setup</strong> wizard at any time</li>
        </ul>
      </div>
    ),
    page: "MyAccount",
  },
  {
    target: "[data-tour='myaccount-stats']",
    placement: "bottom",
    disableBeacon: true,
    title: "📈 Your Metrics",
    content: (
      <div className="space-y-1 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          Your key stats — <strong>total loaners</strong>, <strong>overdue count</strong>, <strong>due soon</strong>, and <strong>missing parts</strong> — are always visible at the top of this page so you have a complete picture of your responsibilities.
        </p>
      </div>
    ),
    page: "MyAccount",
  },
  // ── DONE ──
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "🎉 You're All Set!",
    content: (
      <div className="space-y-2 text-left">
        <p className="text-gray-600 text-sm leading-relaxed">
          You now know your way around Relay. Here's a quick recap:
        </p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc ml-4">
          <li><strong>My Loaners</strong> — track & manage your active sets</li>
          <li><strong>Missing Parts</strong> — log and resolve missing components</li>
          <li><strong>Marketplace</strong> — trade parts with your team</li>
          <li><strong>Track Log</strong> — full audit trail of returns & transfers</li>
          <li><strong>My Account</strong> — metrics, accounts & preferences</li>
        </ul>
        <p className="text-gray-500 text-xs mt-2">You can revisit this tour anytime from <strong>My Account → Re-run profile setup</strong>.</p>
      </div>
    ),
    page: null,
  },
];

const joyrideStyles = {
  options: {
    primaryColor: "#2563eb",
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: "14px",
    padding: "20px 24px",
    maxWidth: "380px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  },
  tooltipTitle: {
    fontSize: "15px",
    fontWeight: "700",
    marginBottom: "8px",
    color: "#111827",
  },
  tooltipContent: {
    padding: "0",
  },
  buttonNext: {
    backgroundColor: "#2563eb",
    borderRadius: "8px",
    fontSize: "13px",
    padding: "8px 18px",
    fontWeight: "600",
  },
  buttonBack: {
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: "500",
  },
  buttonSkip: {
    color: "#9ca3af",
    fontSize: "12px",
  },
  spotlight: {
    borderRadius: "10px",
  },
};

// Wait for a DOM element matching `selector` to appear, polling every 100ms up to `maxWait`ms
function waitForElement(selector, maxWait = 3000) {
  return new Promise((resolve) => {
    if (selector === "body") { resolve(true); return; }
    const start = Date.now();
    const check = () => {
      if (document.querySelector(selector)) { resolve(true); return; }
      if (Date.now() - start > maxWait) { resolve(false); return; }
      setTimeout(check, 100);
    };
    check();
  });
}

export default function AppTour({ onFinish }) {
  const navigate = useNavigate();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const navigatingRef = useRef(false);

  // Start the tour after a short delay to allow page to mount
  useEffect(() => {
    const t = setTimeout(() => setRun(true), 300);
    return () => clearTimeout(t);
  }, []);

  const handleCallback = useCallback((data) => {
    const { action, index, status, type } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      onFinish();
      return;
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (navigatingRef.current) return;

      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      if (nextIndex < 0 || nextIndex >= tourSteps.length) return;

      const nextStep = tourSteps[nextIndex];
      const currentStep = tourSteps[index];

      // If the next step is on a different page than the current step, navigate
      if (nextStep?.page && nextStep.page !== currentStep?.page) {
        navigatingRef.current = true;
        setRun(false);
        navigate(createPageUrl(nextStep.page));

        // Poll for the target element to appear, then resume
        waitForElement(nextStep.target, 3000).then(() => {
          setStepIndex(nextIndex);
          setRun(true);
          navigatingRef.current = false;
        });
      } else {
        setStepIndex(nextIndex);
      }
    }
  }, [navigate, onFinish]);

  return (
    <Joyride
      steps={tourSteps}
      stepIndex={stepIndex}
      run={run}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      spotlightClicks={false}
      disableOverlayClose
      styles={joyrideStyles}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish Tour",
        next: "Next →",
        skip: "Skip Tour",
      }}
      callback={handleCallback}
    />
  );
}