import React from 'react';
import './Loader.scss';

export const Loader = ({ message = 'Loading Paysonic Data...', fullScreen = false }) => {
  return (
    <div className={`c-loader ${fullScreen ? 'c-loader--fullscreen' : ''}`}>
      <div className="c-loader__ring">
        <div />
        <div />
        <div />
        <div />
      </div>
      {message && <p className="c-loader__text">{message}</p>}
    </div>
  );
};

export default Loader;
