import React from "react";
import { Link, Redirect } from "react-router-dom";
import { connect } from "react-redux";
import PropTypes from "prop-types";

const Landing = ({ isAuthenticated }) => {
  if (isAuthenticated) {
    return <Redirect to='/dashboard' />;
  }

  return (
    <section className='main-section'>
      <div className='main-div'>
        <div className='left-div'>
          <div className='left-div-content'>
            <div className='logo-title-div'>
              <h1>{"< Dev"}</h1>
              <h1 style={{ marginLeft: "95px", marginTop: "-40px" }}>
                {"Book >"}
              </h1>
            </div>
            <div className='landing-copy-div'>
              <h2 style={{ marginLeft: "95px", marginBottom: "30px" }}>
                The community of coders
              </h2>
              <h3 style={{ marginLeft: "95px" }}>
                share / learn / code / hire
              </h3>
            </div>
          </div>
        </div>
        <div className='right-div'>
          <div className='homepage-buttons'>
            <Link to='/login'>
              <button className='btn-primary'>Login</button>
            </Link>
            <Link to='/register'>
              <button
                style={{ marginTop: "10px" }}
                className='btn-primary btn-secondary'
              >
                Register
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

Landing.protoTypes = {
  isAuthenticated: PropTypes.bool
};

const mapStateToProps = state => ({
  isAuthenticated: state.auth.isAuthenticated
});

export default connect(mapStateToProps)(Landing);
