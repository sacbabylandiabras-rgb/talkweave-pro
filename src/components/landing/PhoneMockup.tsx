import messageReference from "@/assets/whatsapp-message-reference.png";

const PhoneMockup = () => {
  return (
    <div className="landing-phone-showcase">
      <div className="landing-phone-frame">
        <span className="landing-phone-button landing-phone-button--volume-up" />
        <span className="landing-phone-button landing-phone-button--volume-down" />
        <span className="landing-phone-button landing-phone-button--power" />

        <div className="landing-phone-screen-wrap">
          <div className="landing-phone-notch" />
          <div className="landing-phone-screen">
            <img
              src={messageReference}
              alt="Mensagem promocional do WhatsApp exibida na tela do celular"
              className="landing-phone-image"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneMockup;
