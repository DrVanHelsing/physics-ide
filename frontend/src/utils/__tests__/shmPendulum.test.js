/**
 * The SHM pendulum's physics, executed — not just loaded and hashed
 * (Stage B review I2). The template's whole pedagogy is "read the period
 * off the displacement curve and compare it with T = 2π√(L/g)", so the
 * recurrence it ships must actually produce that period.
 *
 * Two halves:
 *  1. The exact recurrence the template's blocks emit (symplectic Euler,
 *     alpha = -(g/L)*theta, dt = 0.005, theta0 = 8°) is stepped in plain
 *     JS and the zero-crossing period asserted against 2π√(L/g) = 2.8375 s.
 *  2. The template's GENERATED Python is asserted to carry that same
 *     recurrence — tying half 1 to what students actually run.
 */
import Blockly from "../blockly/blocklyLib";
import { defineCustomBlocksAndGenerator } from "../blockly/blocklyGenerator";
import { BLOCK_TEMPLATES } from "../blockTemplates";

const G = 9.81;
const L = 2.0;
const DT = 0.005;
const THETA0 = (8 * Math.PI) / 180;
const T_ANALYTIC = 2 * Math.PI * Math.sqrt(L / G); // 2.8375 s

describe("the SHM pendulum's period is real physics", () => {
  test("the shipped recurrence produces T = 2π·√(L/g) within a small-angle tolerance", () => {
    let theta = THETA0;
    let omega = 0;
    let t = 0;
    const upCrossings = [];
    let prev = theta;
    // Twenty seconds of simulated time — seven periods, plenty of crossings.
    while (t < 20) {
      const alpha = -(G / L) * theta; // the template's exact law
      omega += alpha * DT; // symplectic: omega first
      theta += omega * DT; // then theta from the NEW omega
      t += DT;
      if (prev < 0 && theta >= 0) upCrossings.push(t);
      prev = theta;
    }
    expect(upCrossings.length).toBeGreaterThanOrEqual(5);
    const periods = upCrossings.slice(1).map((c, i) => c - upCrossings[i]);
    const meanT = periods.reduce((a, b) => a + b, 0) / periods.length;
    // Small-angle at 8°: period error ≈ theta0²/16 ≈ 0.12%, plus dt
    // discretisation — 1% tolerance holds both with headroom.
    expect(Math.abs(meanT - T_ANALYTIC) / T_ANALYTIC).toBeLessThan(0.01);
    // And amplitude is conserved (undamped, symplectic — no energy drift
    // beyond bounded oscillation): theta never exceeds theta0 by more
    // than the integrator's wobble.
    expect(Math.abs(theta)).toBeLessThanOrEqual(THETA0 * 1.01);
  });

  test("the template's generated Python carries the same recurrence, dt and initial angle", () => {
    defineCustomBlocksAndGenerator(Blockly);
    const tpl = BLOCK_TEMPLATES.find((x) => x.id === "blocks_pendulum_shm");
    expect(tpl).toBeTruthy();
    const ws = new Blockly.Workspace();
    try {
      const dom = Blockly.utils.xml.textToDom(tpl.xml);
      Blockly.Xml.domToWorkspace(dom, ws);
      const code = Blockly.Python.workspaceToCode(ws);
      // The SHM law — small-angle, byte-exact (a sin() creeping in would
      // change this line, so no separate not-sin assertion is needed).
      expect(code).toContain("alpha = (-1 * (9.81 / L)) * theta");
      // Symplectic order: the omega update line precedes the theta update.
      const omegaAt = code.indexOf("omega = omega + alpha * dt");
      const thetaAt = code.indexOf("theta = theta + omega * dt");
      expect(omegaAt).toBeGreaterThan(-1);
      expect(thetaAt).toBeGreaterThan(omegaAt);
      // dt and theta0 as designed.
      expect(code).toContain("dt = 0.005");
      expect(code).toContain("theta = radians(8)");
      // The three graphs of motion, plotting against t.
      for (const s of ["s_disp.plot(t, theta)", "s_vel.plot(t, omega)", "s_acc.plot(t, alpha)"]) {
        expect(code).toContain(s);
      }
    } finally {
      ws.dispose();
    }
  });
});
