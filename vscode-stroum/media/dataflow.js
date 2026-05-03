"use strict";
(() => {
  // webview-src/dataflow.ts
  var vscode = acquireVsCodeApi();
  var BG = {
    function: "#4a90d9",
    binding: "#6c757d",
    stream: "#e67e22",
    tag: "#8e44ad",
    fork: "#27ae60"
  };
  var STREAM_HIGHLIGHT = "#e74c3c";
  var HIGHLIGHT_DURATION_MS = 900;
  var EDGE_COLOR = {
    pipe: "#a0aec0",
    call: "#718096",
    emit: "#e67e22",
    handler: "#27ae60",
    parallel: "#27ae60",
    outcome: "#8e44ad"
  };
  var EDGE_DASH = {
    pipe: "none",
    call: "none",
    emit: "6 3",
    handler: "3 3",
    parallel: "10 3",
    outcome: "5 3"
  };
  var cy = null;
  function renderGraph(graph) {
    const container = document.getElementById("graph");
    if (cy) {
      try {
        cy.destroy();
      } catch {
      }
      cy = null;
    }
    const elements = [];
    for (const n of graph.nodes) {
      elements.push({
        data: {
          id: n.id,
          label: n.label,
          kind: n.kind,
          isExternal: n.isExternal ?? false,
          params: n.params?.join(", ") ?? ""
        }
      });
    }
    for (const e of graph.edges) {
      elements.push({
        data: {
          id: e.id,
          source: e.from,
          target: e.to,
          kind: e.kind,
          label: e.label ?? ""
        }
      });
    }
    cy = cytoscape({
      container,
      elements,
      layout: {
        name: "dagre",
        rankDir: "LR",
        nodeSep: 60,
        rankSep: 120,
        edgeSep: 20,
        padding: 30
      },
      style: buildStyle(),
      wheelSensitivity: 0.3
    });
  }
  function buildStyle() {
    return [
      {
        selector: "node",
        style: {
          label: "data(label)",
          "font-size": "12px",
          "font-family": "monospace",
          color: "#fff",
          "text-valign": "center",
          "text-halign": "center",
          "text-wrap": "wrap",
          "text-max-width": "90px",
          "border-width": 0,
          padding: "10px",
          width: "label",
          height: "label"
        }
      },
      // Per-kind node styles
      ...["function", "binding", "stream", "tag", "fork"].map((kind) => ({
        selector: `node[kind="${kind}"]`,
        style: {
          "background-color": BG[kind],
          shape: nodeShape(kind),
          ...kind === "function" ? {} : {}
        }
      })),
      // External (stdlib) functions — slightly muted
      {
        selector: "node[?isExternal]",
        style: {
          "background-color": "#3a6fa0",
          opacity: 0.75
        }
      },
      // Edges
      {
        selector: "edge",
        style: {
          width: 2,
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          label: "data(label)",
          "font-size": "10px",
          color: "#a0aec0",
          "text-background-color": "transparent"
        }
      },
      ...["pipe", "call", "emit", "handler", "parallel", "outcome"].map((kind) => ({
        selector: `edge[kind="${kind}"]`,
        style: {
          "line-color": EDGE_COLOR[kind],
          "target-arrow-color": EDGE_COLOR[kind],
          "line-dash-pattern": EDGE_DASH[kind] === "none" ? [] : EDGE_DASH[kind].split(" ").map(Number),
          "line-style": EDGE_DASH[kind] === "none" ? "solid" : "dashed"
        }
      }))
    ];
  }
  function nodeShape(kind) {
    switch (kind) {
      case "function":
        return "ellipse";
      case "binding":
        return "roundrectangle";
      case "stream":
        return "diamond";
      case "tag":
        return "hexagon";
      case "fork":
        return "octagon";
    }
  }
  function handleEvent(msg) {
    const nodeId = `stream:${msg.stream}`;
    if (cy) {
      const node = cy.getElementById(nodeId);
      if (node.length) {
        node.style({ "background-color": STREAM_HIGHLIGHT });
        setTimeout(() => {
          node.style({ "background-color": BG.stream });
        }, HIGHLIGHT_DURATION_MS);
      }
    }
    const list = document.getElementById("log-list");
    const li = document.createElement("li");
    const time = new Date(msg.ts).toLocaleTimeString();
    const valueStr = safeJson(msg.value);
    li.innerHTML = `<span class="ts">${time}</span><span class="stream-name">@${msg.stream}</span><span class="value">${escHtml(valueStr)}</span>` + (msg.fn ? `<span class="fn">${escHtml(msg.fn)}()</span>` : "");
    list.prepend(li);
    while (list.children.length > 200) list.removeChild(list.lastChild);
  }
  function updateStatus(state, message) {
    const statusEl = document.getElementById("status");
    const runBtn = document.getElementById("run-btn");
    const stopBtn = document.getElementById("stop-btn");
    statusEl.textContent = state === "running" ? "Running\u2026" : state === "error" ? `Error: ${message ?? ""}` : "";
    statusEl.className = `status-${state}`;
    runBtn.disabled = state === "running";
    stopBtn.disabled = state !== "running";
  }
  function safeJson(v) {
    try {
      const s = JSON.stringify(v);
      return s !== void 0 ? s.length > 80 ? s.slice(0, 77) + "\u2026" : s : String(v);
    } catch {
      return String(v);
    }
  }
  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "graph":
        renderGraph(msg);
        break;
      case "event":
        handleEvent(msg);
        break;
      case "status":
        updateStatus(msg.state, msg.message);
        break;
    }
  });
  document.getElementById("run-btn").addEventListener("click", () => vscode.postMessage({ type: "run" }));
  document.getElementById("stop-btn").addEventListener("click", () => vscode.postMessage({ type: "stop" }));
  updateStatus("stopped");
  vscode.postMessage({ type: "ready" });
})();
