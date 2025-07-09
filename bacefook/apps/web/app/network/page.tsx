"use client";

import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

interface User {
  id: number;
  name: string;
  createdAt: string;
}

interface Friend {
  id: number;
  name: string;
  status: string;
  createdAt: string;
}

interface Referral {
  id: number;
  name: string;
  referredAt: string;
}

interface NetworkData {
  user: User;
  friends: Friend[];
  referrals: {
    given: Referral[];
    received: Referral[];
  };
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: "user" | "friend" | "referral";
  isCenter?: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: "friend" | "referral";
  label: string;
}

export default function NetworkPage() {
  const [userName, setUserName] = useState("");
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchNetwork = async (name: string) => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:3001/api/network/${encodeURIComponent(name.trim())}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch network data");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNetwork(userName);
  };

  const renderGraph = (networkData: NetworkData) => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    // Create nodes and links
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Add center user
    const centerUser: GraphNode = {
      id: networkData.user.name,
      name: networkData.user.name,
      type: "user",
      isCenter: true,
    };
    nodes.push(centerUser);
    nodeMap.set(centerUser.id, centerUser);

    // Add friends (filter out self-references)
    networkData.friends.forEach((friend) => {
      if (friend.name !== networkData.user.name) {
        if (!nodeMap.has(friend.name)) {
          const friendNode: GraphNode = {
            id: friend.name,
            name: friend.name,
            type: "friend",
          };
          nodes.push(friendNode);
          nodeMap.set(friend.name, friendNode);
        }

        links.push({
          source: networkData.user.name,
          target: friend.name,
          type: "friend",
          label: "Friend",
        });
      }
    });

    // Add referrals given (people this user referred)
    networkData.referrals.given.forEach((referral) => {
      if (referral.name !== networkData.user.name) {
        if (!nodeMap.has(referral.name)) {
          const referralNode: GraphNode = {
            id: referral.name,
            name: referral.name,
            type: "referral",
          };
          nodes.push(referralNode);
          nodeMap.set(referral.name, referralNode);
        }

        links.push({
          source: networkData.user.name,
          target: referral.name,
          type: "referral",
          label: "Referred ➤",
        });
      }
    });

    // Add referrals received (people who referred this user)
    networkData.referrals.received.forEach((referral) => {
      if (referral.name !== networkData.user.name) {
        if (!nodeMap.has(referral.name)) {
          const referrerNode: GraphNode = {
            id: referral.name,
            name: referral.name,
            type: "referral",
          };
          nodes.push(referrerNode);
          nodeMap.set(referral.name, referrerNode);
        }

        links.push({
          source: referral.name,
          target: networkData.user.name,
          type: "referral",
          label: "Referred ➤",
        });
      }
    });

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(180)
      )
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d: any) => (d.isCenter ? 70 : 60))
      );

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add arrow markers for referral relationships
    const defs = svg.append("defs");

    // Referral arrow marker (more prominent)
    defs
      .append("marker")
      .attr("id", "referral-arrow")
      .attr("viewBox", "0 -6 12 12")
      .attr("refX", 62)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-6L12,0L0,6")
      .attr("fill", "#f59e0b")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 1);

    // Create links
    const link = g
      .selectAll(".link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("stroke", (d: GraphLink) =>
        d.type === "friend" ? "#10b981" : "#f59e0b"
      )
      .attr("stroke-width", (d: GraphLink) => (d.type === "referral" ? 3 : 2))
      .attr("stroke-opacity", 0.8)
      .attr("marker-end", (d: GraphLink) =>
        d.type === "referral" ? "url(#referral-arrow)" : null
      );

    // Create nodes
    const node = g
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on(
            "start",
            (
              event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>,
              d: GraphNode
            ) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            }
          )
          .on(
            "drag",
            (
              event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>,
              d: GraphNode
            ) => {
              d.fx = event.x;
              d.fy = event.y;
            }
          )
          .on(
            "end",
            (
              event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>,
              d: GraphNode
            ) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            }
          )
      );

    // Add text first to measure dimensions
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", (d: GraphNode) => (d.isCenter ? "14px" : "12px"))
      .attr("font-weight", (d: GraphNode) => (d.isCenter ? "bold" : "normal"))
      .attr("fill", "white")
      .attr("dy", "0.35em")
      .text((d: GraphNode) => d.name);

    // Add rectangles that fit the text
    node
      .insert("rect", "text")
      .attr("width", function (d: GraphNode) {
        const textElement = this.parentNode?.querySelector("text");
        if (!textElement) return 100;
        const textLength = textElement.getBBox().width;
        return Math.max(textLength + 16, d.isCenter ? 120 : 100);
      })
      .attr("height", (d: GraphNode) => (d.isCenter ? 32 : 28))
      .attr("x", function (d: GraphNode) {
        const textElement = this.parentNode?.querySelector("text");
        if (!textElement) return -50;
        const textLength = textElement.getBBox().width;
        const width = Math.max(textLength + 16, d.isCenter ? 120 : 100);
        return -width / 2;
      })
      .attr("y", (d: GraphNode) => (d.isCenter ? -16 : -14))
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", (d: GraphNode) => {
        if (d.isCenter) return "#3b82f6";
        if (d.type === "friend") return "#10b981";
        return "#f59e0b";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add edge labels
    const edgeLabels = g
      .selectAll(".edge-label")
      .data(links)
      .enter()
      .append("text")
      .attr("class", "edge-label")
      .attr("font-size", "10px")
      .attr("fill", "#666")
      .attr("text-anchor", "middle")
      .text((d: GraphLink) => d.label);

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => (d.source as GraphNode).x || 0)
        .attr("y1", (d: any) => (d.source as GraphNode).y || 0)
        .attr("x2", (d: any) => (d.target as GraphNode).x || 0)
        .attr("y2", (d: any) => (d.target as GraphNode).y || 0);

      node.attr(
        "transform",
        (d: GraphNode) => `translate(${d.x || 0},${d.y || 0})`
      );

      edgeLabels
        .attr(
          "x",
          (d: any) =>
            (((d.source as GraphNode).x || 0) +
              ((d.target as GraphNode).x || 0)) /
            2
        )
        .attr(
          "y",
          (d: any) =>
            (((d.source as GraphNode).y || 0) +
              ((d.target as GraphNode).y || 0)) /
              2 -
            5
        );
    });
  };

  useEffect(() => {
    if (data) {
      renderGraph(data);
    }
  }, [data]);

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Network Relationship Viewer
      </h1>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2 justify-center">
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter username (e.g., user00001)"
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">
              Network Graph for {data.user.name}
            </h2>

            <div className="mb-4 space-y-2">
              <div className="flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 bg-blue-500 rounded"></div>
                  <span>Center User</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 bg-green-500 rounded"></div>
                  <span>Friends</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 bg-yellow-500 rounded"></div>
                  <span>Referrals</span>
                </div>
              </div>
              <div className="flex justify-center gap-8 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <div className="w-6 h-0.5 bg-green-500"></div>
                  <span>Friendship (undirected)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-0.5 bg-yellow-500"></div>
                  <span>➤</span>
                  <span>Referral (directed)</span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <svg
                ref={svgRef}
                width="800"
                height="600"
                className="mx-auto"
                style={{ background: "white", borderRadius: "8px" }}
              />
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">
                How to read the graph:
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>
                  • <strong>Green lines:</strong> Mutual friendships (no
                  direction)
                </li>
                <li>
                  • <strong>Orange arrows:</strong> Referrals - arrow points
                  FROM referrer TO person being referred
                </li>
                <li>
                  • <strong>Drag nodes</strong> to rearrange the graph for
                  better viewing
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold text-gray-700 mb-2">User Info</h3>
              <p>
                <strong>Name:</strong> {data.user.name}
              </p>
              <p>
                <strong>ID:</strong> {data.user.id}
              </p>
              <p>
                <strong>Created:</strong>{" "}
                {new Date(data.user.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold text-gray-700 mb-2">Friends</h3>
              <p>
                <strong>Total:</strong> {data.friends.length}
              </p>
              <p>
                <strong>Active:</strong>{" "}
                {data.friends.filter((f) => f.status === "ACTIVE").length}
              </p>
              <p>
                <strong>Inactive:</strong>{" "}
                {data.friends.filter((f) => f.status === "INACTIVE").length}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold text-gray-700 mb-2">Referrals</h3>
              <p>
                <strong>Given:</strong> {data.referrals.given.length}
              </p>
              <p>
                <strong>Received:</strong> {data.referrals.received.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
