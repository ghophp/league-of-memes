import React from "react";

import Logo from "./images/logo.png";

import styles from "./stylesheets/sass/loading.module.sass";

interface LoadingInterface {
  message: string;
}

const Loading = ({ message }: LoadingInterface): React.ReactElement => {
  return (
    <div className={styles.loading}>
      <img
        className={styles.loading_logo}
        src={Logo}
        alt="Rift Explorer logo"
      />
      <br />
      <br />
      <div className={styles.loading_text}>{message}</div>
    </div>
  );
};

export default Loading;
