import React, { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GravityPlayground from "./GravityPlayground";
import {
  BlocksIcon,
  OrbitIcon,
  ChartIcon,
  LocalFirstIcon,
  GraduationCapIcon,
  PrivacyIcon,
} from "../components/Icons";
import { WELCOME_PASSED_SESSION_KEY } from "../constants";

const FEATURES = [
  { Icon: BlocksIcon, title: "Blocks or Python", body: "Start with drag-and-drop blocks, flip to real Python whenever you're ready — same project, both views." },
  { Icon: OrbitIcon, title: "Live 3D simulations", body: "VPython scenes render as your code runs: orbits, springs, collisions, projectiles — watch physics happen." },
  { Icon: ChartIcon, title: "Charts & data", body: "Every run captures data you can plot, fit, and analyse — the data-science half of the lab." },
  { Icon: LocalFirstIcon, title: "Yours, offline", body: "Everything saves to your computer first. Wi-Fi dies mid-lesson? Keep working. Sign in and projects follow you to any computer." },
  { Icon: GraduationCapIcon, title: "Classrooms", body: "Teachers create classes, share a join code or QR, and manage rosters. Assignments and marking are on the way." },
  { Icon: PrivacyIcon, title: "No surveillance", body: "No tracking, no paste detection, no webcam. Just an honest record of how your work grew." },
];

export default function WelcomePage() {
  const navigate = useNavigate();

  const go = useCallback(
    (path) => {
      // Session-scoped pass: "/" renders the IDE for the rest of this browser
      // session, and a new session meets the front door again.
      sessionStorage.setItem(WELCOME_PASSED_SESSION_KEY, "1");
      navigate(path);
    },
    [navigate],
  );

  useEffect(() => {
    const els = document.querySelectorAll(".welcome-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add("is-on");
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="welcome">
      <header className="welcome-hero">
        <div className="welcome-orbit" aria-hidden="true">
          <div className="welcome-orbit__sun" />
          <div className="welcome-orbit__path welcome-orbit__path--a"><i /></div>
          <div className="welcome-orbit__path welcome-orbit__path--b"><i /></div>
        </div>
        <h1>Physics IDE</h1>
        <p className="welcome-tagline">
          Build, run, and understand physics — right in your browser.
        </p>
        <div className="welcome-cta">
          <button className="welcome-btn welcome-btn--primary" type="button" onClick={() => go("/")}>
            Use the IDE — no account needed
          </button>
          <button className="welcome-btn" type="button" onClick={() => go("/auth/signup")}>
            Create an account
          </button>
          <button className="welcome-btn" type="button" onClick={() => go("/auth/signin")}>
            Sign in
          </button>
        </div>
      </header>

      <section className="welcome-features">
        {FEATURES.map((f) => (
          <article key={f.title} className="welcome-card welcome-reveal">
            <span className="welcome-card__icon" aria-hidden="true"><f.Icon size={28} /></span>
            <h2>{f.title}</h2>
            <p>{f.body}</p>
          </article>
        ))}
      </section>

      <section className="welcome-play welcome-reveal">
        <h2>Feel it work</h2>
        <p>This little box runs the same idea the IDE does — rules in, motion out.</p>
        <GravityPlayground />
      </section>

      <footer className="welcome-foot welcome-reveal">
        <p>
          Free for classrooms. Your work saves to your computer first; an account adds sync,
          classes, and nothing you didn't ask for.
        </p>
        <button className="welcome-btn welcome-btn--primary" type="button" onClick={() => go("/")}>
          Open the IDE
        </button>
      </footer>
    </div>
  );
}
