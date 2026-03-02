import { useState, useEffect } from "react";

interface Review {
  id: string;
  name: string;
  city: string;
  rating: number;
  review_text: string;
}

const staticReviews: Review[] = [
  {
    id: "1",
    name: "प्रिया पाटील",
    city: "पुणे",
    rating: 5,
    review_text: "स्नेहयोगामुळे माझं आयुष्य बदललं! फक्त ३ महिन्यात माझं वजन ८ किलो कमी झालं आणि मला खूप एनर्जी मिळाली. ट्रेनर्स खूप सपोर्टिव्ह आहेत."
  },
  {
    id: "2",
    name: "राजेश शर्मा",
    city: "मुंबई",
    rating: 5,
    review_text: "ऑनलाइन योगा क्लासेस घरबसल्या करता येतात, वेळ वाचतो आणि फी पण कमी आहे. माझं BP नियंत्रणात आलं आहे."
  },
  {
    id: "3",
    name: "सुनीता देशमुख",
    city: "नाशिक",
    rating: 5,
    review_text: "थायरॉइड आणि PCOS साठी योगा खूप उपयुक्त आहे. स्नेहयोगाच्या विशेष सत्रांमुळे माझी तब्येत सुधारली."
  }
];

const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % staticReviews.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const currentReview = staticReviews[currentIndex];

  return (
    <section style={{ backgroundColor: '#f8f9fa', padding: '32px 16px' }}>
      <div style={{ maxWidth: '448px', margin: '0 auto' }}>
        <p style={{ color: '#5D3A1A', textAlign: 'center', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
          प्रशंसापत्रे
        </p>
        <h2 style={{ fontSize: '30px', fontWeight: 'bold', textAlign: 'center', marginBottom: '32px' }}>
          आमच्या सदस्यांच्या कथा
        </h2>

        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              backgroundColor: '#E8962E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              {currentReview.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontWeight: 600, marginBottom: '4px' }}>{currentReview.name}</h3>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{currentReview.city}</p>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: currentReview.rating }).map((_, i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#E8962E" stroke="#E8962E">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>

          <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.6 }}>
            {currentReview.review_text}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          {staticReviews.map((_, index) => (
            <div
              key={index}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: index === currentIndex ? '#E8962E' : '#e5e7eb',
                transition: 'background-color 0.3s'
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
