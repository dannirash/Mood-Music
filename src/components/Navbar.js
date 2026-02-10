import React from "react";
import { Link, NavLink } from "react-router-dom";
import "./Navbar.css";
import { LibraryMusic } from "@mui/icons-material";

function Navbar() {
  const navItems = [
    { to: "/", label: "Home", exact: true },
    { to: "/camera", label: "Camera" },
    { to: "/upload", label: "Upload" },
    { to: "/mood-wheel", label: "Mood Wheel" },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span>MoodMusic</span>
          <LibraryMusic sx={{ color: "#33d2c1", fontSize: 30 }} />
        </Link>
        <div className="navbar-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `navbar-link ${isActive ? "navbar-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
