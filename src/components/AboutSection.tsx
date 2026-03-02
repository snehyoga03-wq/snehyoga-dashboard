const AboutSection = () => {
  return (
    <section className="bg-muted px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <p className="text-accent text-center text-sm font-semibold mb-2">
          आमच्याबद्दल
        </p>
        <h2 className="text-3xl font-bold text-center text-foreground mb-6">
          Snehyoga
        </h2>
        
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p className="text-center text-lg font-semibold text-foreground">
            ✨ तुमच्या संपूर्ण आरोग्यासाठी विश्वासार्ह सोबती! ✨
          </p>
          
          <p>
            🧘‍♀️ <strong className="text-foreground">योगाच्या माध्यमातून संपूर्ण आरोग्याची गुरुकिल्ली!</strong>
          </p>
          
          <p>
            "Snehyoga" मध्ये आपले मनःपूर्वक स्वागत आहे! आमच्या योग क्लासमध्ये तुम्हाला केवळ शारीरिक नव्हे तर मानसिक आणि भावनिक आरोग्य सुधारण्याची संधी मिळेल.
          </p>

          <div className="bg-background rounded-xl p-5 my-4">
            <h3 className="text-base font-bold text-foreground mb-3">Snehyoga 365 मध्ये समाविष्ट</h3>
            <ul className="space-y-2 ml-4">
              <li>✅ Daily Yogasanas</li>
              <li>✅ Pranayama And Meditations</li>
              <li>✅ Face yoga session</li>
              <li>✅ Sharir shuddhi Kriya</li>
              <li>✅ Community Support</li>
              <li>✅ Supports weight loss</li>
              <li>✅ Generic Diet plan (1 year plan)</li>
            </ul>
          </div>

          <div className="bg-background rounded-xl p-5 my-4">
            <h3 className="text-base font-bold text-foreground mb-3">आरोग्याचे फायदे</h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-foreground mb-2">१. जीवनशैलीशी संबंधित आजार:</h4>
                <ul className="space-y-1 ml-4">
                  <li>✔️ उच्च रक्तदाब आणि मधुमेह</li>
                  <li>✔️ वजन कमी करणे आणि नियंत्रणात ठेवणे</li>
                  <li>✔️ थायरॉईड आणि हार्मोन्सचे असंतुलन</li>
                  <li>✔️ कोलेस्ट्रॉल नियंत्रणात ठेवणे</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">२. शारीरिक समस्या:</h4>
                <ul className="space-y-1 ml-4">
                  <li>✔️ पाठदुखी, मानदुखी, कंबरदुखी</li>
                  <li>✔️ गुडघेदुखी, सांधेदुखी आणि संधिवात</li>
                  <li>✔️ अपचन, ॲसिडिटी आणि बद्धकोष्ठता</li>
                  <li>✔️ मायग्रेन आणि डोकेदुखी</li>
                  <li>✔️ रोगप्रतिकारशक्ती वाढवणे</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">३. स्त्रियांच्या आरोग्य समस्या:</h4>
                <ul className="space-y-1 ml-4">
                  <li>✔️ पीसीओडी/पीसीओएस</li>
                  <li>✔️ अनियमित मासिक पाळी</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">४. मानसिक आरोग्य:</h4>
                <ul className="space-y-1 ml-4">
                  <li>✔️ तणाव, चिंता आणि नैराश्य</li>
                  <li>✔️ झोपेच्या समस्या</li>
                  <li>✔️ एकाग्रता वाढवणे</li>
                  <li>✔️ भावनिक संतुलन</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border-l-4 border-primary rounded-r-xl p-5 my-4">
            <h3 className="text-base font-bold text-foreground mb-2">आमचे वचन</h3>
            <p>
              तुमचे आरोग्य आणि आनंद हाच आमचा प्राधान्यक्रम आहे. या आरोग्यदायी प्रवासात आम्ही प्रत्येक पावलावर तुमच्यासोबत आहोत.
            </p>
          </div>

          <p className="text-center font-semibold text-foreground text-base">
            🕉️ चला, एकत्र मिळून "योग – आरोग्य, शांती आणि आनंद यांचा सुंदर संगम" साधूया! ✨
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;