export interface TemplateButton {
  id: string;
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  language: string;
  headerType?: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  headerContent?: string;
  body: string;
  variables: string[];
  footer?: string;
  buttons: TemplateButton[];
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl_welcome_yoga',
    name: 'sneha_yoga_welcome_greeting',
    category: 'MARKETING',
    status: 'APPROVED',
    language: 'en',
    headerType: 'IMAGE',
    headerContent: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80',
    body: 'Namaste {{1}} 🙏 Welcome to Sneha Yoga Studio!\n\nWe are excited to help you start your wellness journey. Choose an option below to explore our upcoming classes, book a personal trial session, or talk directly with our certified yoga instructor.',
    variables: ['{{1}}'],
    footer: 'Sneha Yoga - Mind, Body & Soul',
    buttons: [
      { id: 'btn_1', type: 'QUICK_REPLY', text: '🧘 View Class Schedule' },
      { id: 'btn_2', type: 'QUICK_REPLY', text: '📅 Book Trial Session' },
      { id: 'btn_3', type: 'QUICK_REPLY', text: '💬 Talk to Instructor' }
    ]
  },
  {
    id: 'tpl_workshop_reg',
    name: 'yoga_workshop_registration',
    category: 'MARKETING',
    status: 'APPROVED',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '✨ Special Weekend Pranayama & Meditation Workshop',
    body: 'Hello {{1}}!\n\nJoin our upcoming {{2}} workshop starting on {{3}}. Learn ancient breathing techniques to reduce stress, boost energy, and enhance focus.\n\nLimited seats available!',
    variables: ['{{1}}', '{{2}}', '{{3}}'],
    footer: 'Reply YES to reserve your spot',
    buttons: [
      { id: 'btn_w1', type: 'QUICK_REPLY', text: '✅ Reserve My Seat' },
      { id: 'btn_w2', type: 'QUICK_REPLY', text: 'ℹ️ View Fee Details' },
      { id: 'btn_w3', type: 'QUICK_REPLY', text: '❓ Have Questions' }
    ]
  },
  {
    id: 'tpl_membership_renewal',
    name: 'membership_expiry_reminder',
    category: 'UTILITY',
    status: 'APPROVED',
    language: 'en',
    headerType: 'NONE',
    body: 'Hi {{1}},\n\nYour Sneha Yoga membership for {{2}} is due for renewal on {{3}}.\n\nRenew today to unlock our special 15% Early Bird Discount for next month!',
    variables: ['{{1}}', '{{2}}', '{{3}}'],
    footer: 'Sneha Yoga Accounts Team',
    buttons: [
      { id: 'btn_r1', type: 'QUICK_REPLY', text: '💳 Renew Membership' },
      { id: 'btn_r2', type: 'QUICK_REPLY', text: '📞 Request Call Back' }
    ]
  },
  {
    id: 'tpl_appointment_confirm',
    name: 'session_booking_confirmation',
    category: 'UTILITY',
    status: 'APPROVED',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '✅ Yoga Session Confirmed',
    body: 'Dear {{1}},\n\nYour {{2}} session has been scheduled for {{3}} at {{4}}.\n\nPlease arrive 10 minutes prior to session time with your yoga mat.',
    variables: ['{{1}}', '{{2}}', '{{3}}', '{{4}}'],
    footer: 'Sneha Yoga Studio',
    buttons: [
      { id: 'btn_c1', type: 'QUICK_REPLY', text: '📍 Get Studio Location' },
      { id: 'btn_c2', type: 'QUICK_REPLY', text: '🔄 Reschedule' }
    ]
  },
  {
    id: 'tpl_feedback_rating',
    name: 'post_class_feedback',
    category: 'UTILITY',
    status: 'APPROVED',
    language: 'en',
    headerType: 'NONE',
    body: 'Hi {{1}}! We hope you enjoyed your {{2}} session today with Instructor Sneha.\n\nHow was your experience?',
    variables: ['{{1}}', '{{2}}'],
    footer: 'Your feedback helps us grow',
    buttons: [
      { id: 'btn_f1', type: 'QUICK_REPLY', text: '⭐ Outstanding (5/5)' },
      { id: 'btn_f2', type: 'QUICK_REPLY', text: '👍 Good (4/5)' },
      { id: 'btn_f3', type: 'QUICK_REPLY', text: '💬 Share Suggestion' }
    ]
  }
];
