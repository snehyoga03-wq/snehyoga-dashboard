import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const ReferralRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      // Redirect to landing page with referral code as query param
      navigate(`/?ref=${code}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [code, navigate]);

  return null;
};

export default ReferralRedirect;
