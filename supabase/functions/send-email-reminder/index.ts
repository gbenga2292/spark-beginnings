import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Hardcoded API Key to avoid manual dashboard configuration
const RESEND_API_KEY = "re_gmEpsxh9_4HguGX9HZswyuZCVHizC7dZJ";

// System injected Postgres vars
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const payload = await req.json();
    const record = payload.record || payload; 
    
    // We only process emails if the record has send_email = true OR if it's a direct task assignment
    if (record.send_email === false || record.sendEmail === false) {
       return new Response(JSON.stringify({ message: "Email sending not requested." }), { status: 200 })
    }

    let title = "";
    let body = "";
    let recipientIds: string[] = [];

    // Is it a Reminder?
    if (record.title && (record.recipient_ids || record.recipientIds)) {
        title = `Reminder: ${record.title}`;
        body = record.body || "You have a pending reminder.";
        recipientIds = record.recipient_ids || record.recipientIds;
    } 
    // Is it a Subtask Assignment?
    else if (record.assigned_to || record.assignedTo) {
        title = `Task Assignment: ${record.title}`;
        body = record.description || "You have been assigned to a new task inside the HR portal.";
        recipientIds = [record.assigned_to || record.assignedTo];
    } else {
        return new Response(JSON.stringify({ error: "Unrecognized payload." }), { status: 400 })
    }

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        return new Response(JSON.stringify({ message: "No valid recipients to email." }), { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profiles } = await supabase.from('profiles').select('email').in('id', recipientIds);

    const emails = profiles?.map(p => p.email).filter(Boolean) || [];

    if (emails.length === 0) {
         return new Response(JSON.stringify({ message: "No valid email addresses found." }), { status: 200 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'DCEL HR Notifications <onboarding@resend.dev>', 
        to: emails,
        subject: title,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
              <h2 style="color: #4F46E5;">${title}</h2>
              <p style="font-size: 16px; color: #333;">${body}</p>
              <br/>
              <hr style="border: none; border-top: 1px solid #eaeaea;" />
              <p style="font-size: 12px; color: #999;">
                  This is an automated notification from DCEL Office Suite.
              </p>
          </div>
        `,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 400 })
  }
})
