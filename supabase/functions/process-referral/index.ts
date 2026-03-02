import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, referralCode } = await req.json()

    console.log('Processing referral for user:', userId, 'with code:', referralCode)

    if (!userId) {
      throw new Error('User ID is required')
    }

    // Generate unique referral code for the new user (using first name + random digits)
    const { data: userData } = await supabaseClient.auth.admin.getUserById(userId)
    const userName = userData?.user?.user_metadata?.name || 'user'
    const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    const newUserReferralCode = userName.toLowerCase().replace(/\s+/g, '') + randomDigits

    // Create referral code for new user
    const { error: codeError } = await supabaseClient
      .from('referral_codes')
      .insert({
        user_id: userId,
        code: newUserReferralCode,
        total_referrals: 0,
        total_days_earned: 0
      })

    if (codeError) {
      console.error('Error creating referral code:', codeError)
      throw codeError
    }

    // If they signed up with a referral code, process it
    if (referralCode) {
      // Find the referrer
      const { data: referrerData, error: referrerError } = await supabaseClient
        .from('referral_codes')
        .select('user_id, total_referrals, total_days_earned')
        .eq('code', referralCode)
        .single()

      if (referrerError) {
        console.error('Referral code not found:', referrerError)
      } else if (referrerData) {
        // Create referral record
        const { error: referralError } = await supabaseClient
          .from('referrals')
          .insert({
            referrer_user_id: referrerData.user_id,
            referred_user_id: userId,
            days_awarded: 7
          })

        if (referralError) {
          console.error('Error creating referral:', referralError)
        } else {
          // Update referrer stats
          const { error: updateError } = await supabaseClient
            .from('referral_codes')
            .update({
              total_referrals: (referrerData.total_referrals || 0) + 1,
              total_days_earned: (referrerData.total_days_earned || 0) + 7
            })
            .eq('user_id', referrerData.user_id)

          if (updateError) {
            console.error('Error updating referrer stats:', updateError)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        referralCode: newUserReferralCode 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in process-referral:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
