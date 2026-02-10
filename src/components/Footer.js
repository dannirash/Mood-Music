import React from "react";
import "./Footer.css";
import { Link } from "react-router-dom";
import { LibraryMusic } from "@mui/icons-material";

function Footer() {
  return (
    <div className="footer-container">
      <section className="footer-subscription">
        <p className="footer-subscription-heading">
          Create custom playlists designed by how you feel
        </p>
        <p className="footer-subscription-text">Start listening today</p>
        <div className="input-areas"></div>
      </section>
      <section className="social-media">
        <div className="social-media-wrap">
          <div className="footer-logo">
            <Link to="/" className="social-logo">
              MoodMusic&nbsp;
              <LibraryMusic sx={{ color: "#33d2c1", fontSize: 32 }} />
            </Link>
          </div>
          <small className="website-rights">MoodMusic © 2026</small>
          <div className="social-icons">
            <a
              className="social-icon-link spotify"
              href="https://open.spotify.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Spotify"
            >
              <i className="fa-brands fa-spotify"></i>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Footer;
