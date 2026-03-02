import { Check } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const PricingPlans = () => {
  // All features for Snehyoga 365
  const allFeatures = [
    "Daily Yogasanas",
    "Pranayama And Meditations",
    "Face yoga session",
    "Sharir shuddhi Kriya",
    "Community Support",
    "Supports weight loss",
  ];

  // Snehyoga 365 Plans
  const plans = [
    {
      name: "Snehyoga 365",
      price: "399",
      duration: "१ महिना",
      durationEng: "1 Month",
      included: [
        "Daily Yogasanas",
        "Pranayama And Meditations",
        "Face yoga session",
        "Sharir shuddhi Kriya",
        "Community Support",
        "Supports weight loss",
      ],
      color: "bg-orange-50 dark:bg-orange-950/20",
      borderColor: "border-orange-200 dark:border-orange-800",
      link: "https://rzp.io/rzp/wiY1N9Cl",
    },
    {
      name: "Snehyoga 365",
      price: "1,800",
      duration: "६ महिने",
      durationEng: "6 Months",
      included: [
        "Daily Yogasanas",
        "Pranayama And Meditations",
        "Face yoga session",
        "Sharir shuddhi Kriya",
        "Community Support",
        "Supports weight loss",
      ],
      color: "bg-amber-50 dark:bg-amber-950/20",
      borderColor: "border-amber-200 dark:border-amber-800",
      link: "https://rzp.io/rzp/QtQfeZT",
      popular: true,
    },
    {
      name: "Snehyoga 365",
      price: "2,400",
      duration: "१ वर्ष",
      durationEng: "1 Year",
      included: [
        "Daily Yogasanas",
        "Pranayama And Meditations",
        "Face yoga session",
        "Sharir shuddhi Kriya",
        "Community Support",
        "Supports weight loss",
        "Generic Diet plan",
      ],
      color: "bg-green-50 dark:bg-green-950/20",
      borderColor: "border-green-200 dark:border-green-800",
      link: "https://rzp.io/rzp/vEaFjMIY",
      bestValue: true,
    },
  ];

  // Extended features for yearly plan
  const yearlyFeatures = [...allFeatures, "Generic Diet plan"];

  return (
    <section className="bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-foreground mb-2">
          Snehyoga 365 Plans
        </h2>
        <p className="text-center text-muted-foreground mb-8">
          Choose Your Time & Plan
        </p>

        {/* Carousel */}
        <Carousel
          opts={{ align: "start", loop: true }}
          plugins={[Autoplay({ delay: 3500 })]}
          className="w-full max-w-sm mx-auto mb-0"
        >
          <CarouselContent>
            {plans.map((plan, index) => (
              <CarouselItem key={index}>
                <div
                  className={`${plan.color} ${plan.borderColor} border-2 rounded-xl p-6 flex flex-col relative`}
                >
                  {/* Header Banner */}
                  {plan.bestValue ? (
                    <div className="bg-green-600 dark:bg-green-700 text-white rounded-t-lg -mx-6 -mt-6 mb-6 p-4 text-center">
                      <h3 className="text-xl font-bold mb-1">{plan.duration}</h3>
                      <p className="text-green-100 text-sm font-semibold">
                        Best Value + Diet Plan
                      </p>
                    </div>
                  ) : plan.popular ? (
                    <div className="bg-amber-500 dark:bg-amber-600 text-white rounded-t-lg -mx-6 -mt-6 mb-6 p-4 text-center">
                      <h3 className="text-xl font-bold mb-1">{plan.duration}</h3>
                      <p className="text-amber-100 text-sm font-semibold">
                        Most Popular
                      </p>
                    </div>
                  ) : (
                    <div className="bg-primary dark:bg-primary text-white rounded-t-lg -mx-6 -mt-6 mb-6 p-4 text-center">
                      <h3 className="text-xl font-bold">{plan.duration}</h3>
                    </div>
                  )}

                  {/* Price Section */}
                  <div className="text-center mb-6">
                    <div className="flex items-baseline justify-center gap-2 mb-2">
                      <span className="text-4xl font-bold text-foreground">
                        ₹{plan.price}/-
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plan.durationEng}
                    </p>
                    <p className="text-lg font-semibold text-primary mt-2">
                      {plan.name}
                    </p>
                  </div>

                  {/* Feature List */}
                  <ul className="space-y-3 flex-grow mb-6">
                    {(plan.bestValue ? yearlyFeatures : allFeatures).map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <Check className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <a
                    href={plan.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center bg-accent hover:bg-accent/90 dark:bg-accent dark:hover:bg-accent/90 text-white font-semibold py-3 rounded-full transition-colors"
                  >
                    Register Now
                  </a>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          <CarouselPrevious />
          <CarouselNext />
        </Carousel>

        {/* Diet Plan Section */}
        <div className="bg-card rounded-xl p-6 mt-6">
          <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            🍽️ डाएट प्लॅन (1 Year Plan)
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            १ वर्षाच्या प्लॅनसोबत Generic Diet plan मिळतो जे घरगुती आहारावर आधारित असते –
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm">
              <span className="text-accent">🕰️</span>
              <span className="text-foreground">
                <strong>कोणत्या वेळी खायचं</strong>
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <span className="text-accent">🍛</span>
              <span className="text-foreground">
                <strong>काय खायचं</strong>
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <span className="text-accent">📏</span>
              <span className="text-foreground">
                <strong>किती खायचं</strong>
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <span className="text-accent">🍽️</span>
              <span className="text-foreground">
                <strong>कसे खायचं</strong>
              </span>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">
            🧘‍♀️ योग + आहार नियोजन यांच्या मदतीने वजन कमी करायला मदत होते. 🙏
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingPlans;