import { useEffect } from "react";

const Landing = () => {
  useEffect(() => {
    window.location.replace("/landing/index.html");
  }, []);
  return null;
};

export default Landing;
