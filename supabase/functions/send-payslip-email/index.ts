import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const DEFAULT_RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const {
      to,
      subject,
      html,
      attachments = [],
      provider: requestedProvider,
      emailSettings: overrideSettings,
      action = 'send', // 'send' | 'test_connection'
    } = payload;

    if (!to) {
      return new Response(
        JSON.stringify({ success: false, error: 'Recipient email address is required.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Resolve email settings from payload or app_settings database table
    let settings = overrideSettings;
    if ((!settings || Object.keys(settings).length === 0) && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data } = await supabase
        .from('app_settings')
        .select('email_settings')
        .limit(1)
        .maybeSingle();
      settings = data?.email_settings || {};
    }

    settings = settings || {};
    const provider = requestedProvider || settings.provider || (settings.smtpHost ? 'smtp' : 'resend');

    if (provider === 'smtp') {
      const {
        smtpHost,
        smtpPort = 465,
        smtpSecure = true,
        smtpUser,
        smtpPass,
        smtpFromEmail,
        smtpFromName = 'DCEL Payroll',
      } = settings;

      if (!smtpHost || !smtpUser || !smtpPass) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Incomplete SMTP configuration. Host, username, and password must be configured in Settings > Email.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const portNum = Number(smtpPort) || 465;
      const isSecure = Boolean(smtpSecure) || portNum === 465;

      try {
        const createTransporter = (hostToUse: string, servernameOverride?: string) => {
          return nodemailer.createTransport({
            host: hostToUse,
            port: portNum,
            secure: isSecure,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
            tls: {
              rejectUnauthorized: false, // Prevents self-signed cert failures
              checkServerIdentity: () => undefined,
              ...(servernameOverride ? { servername: servernameOverride } : {}),
            },
          });
        };

        let activeHost = smtpHost;
        let transporter = createTransporter(activeHost);

        try {
          if (action === 'test_connection') {
            await transporter.verify();
          }
        } catch (firstErr: any) {
          const errMsg = String(firstErr?.message || '');
          const match = errMsg.match(/certificate is only valid for DnsName\("([^"]+)"\)/i);
          if (match && match[1]) {
            const validHost = match[1];
            console.warn(`SMTP SSL mismatch: '${activeHost}' cert is for '${validHost}'. Auto-retrying with valid host...`);
            activeHost = validHost;
            transporter = createTransporter(validHost, validHost);
            if (action === 'test_connection') {
              await transporter.verify();
            }
          } else {
            throw firstErr;
          }
        }

        const fromAddress = smtpFromEmail || smtpUser;
        const fromHeader = `"${smtpFromName}" <${fromAddress}>`;

        const mailOptions = {
          from: fromHeader,
          to: Array.isArray(to) ? to.join(', ') : to,
          subject: subject || (action === 'test_connection' ? 'DCEL Email Configuration Test' : 'Your Payslip'),
          html: html || '<p>This is a test notification from DCEL Office Suite.</p>',
          attachments: (attachments || []).map((att: any) => ({
            filename: att.filename || 'Payslip.pdf',
            content: att.content, // base64 string
            encoding: 'base64',
            contentType: att.contentType || 'application/pdf',
          })),
        };

        let info;
        try {
          info = await transporter.sendMail(mailOptions);
        } catch (sendErr: any) {
          const sendErrMsg = String(sendErr?.message || '');
          const match = sendErrMsg.match(/certificate is only valid for DnsName\("([^"]+)"\)/i);
          if (match && match[1] && activeHost !== match[1]) {
            const validHost = match[1];
            console.warn(`SMTP send SSL mismatch: Retrying sendMail via '${validHost}'...`);
            activeHost = validHost;
            transporter = createTransporter(validHost, validHost);
            info = await transporter.sendMail(mailOptions);
          } else {
            throw sendErr;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            provider: 'smtp',
            messageId: info?.messageId || 'OK',
            autoRecoveredHost: activeHost !== smtpHost ? activeHost : undefined,
            notice: activeHost !== smtpHost
              ? `Note: Successfully connected using the mail server's SSL certificate hostname (${activeHost}). Consider saving "${activeHost}" as your SMTP Host in Settings.`
              : undefined,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (smtpErr: any) {
        console.error('SMTP Delivery error:', smtpErr);
        let errorMsg = smtpErr?.message || 'Failed to authenticate or connect with SMTP server. Check credentials, port, and security settings.';
        const match = errorMsg.match(/certificate is only valid for DnsName\("([^"]+)"\)/i);
        if (match && match[1]) {
          errorMsg = `SSL Certificate Name Mismatch: Your mail server's SSL certificate is issued to "${match[1]}", not "${smtpHost}". Please set your SMTP Host in Settings to "${match[1]}" and try again.`;
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: `SMTP Error: ${errorMsg}`,
            suggestedHost: match ? match[1] : undefined,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Resend API Provider
      const apiKey = settings.resendApiKey || DEFAULT_RESEND_KEY;
      const fromEmail = settings.resendFromEmail || 'onboarding@resend.dev';
      const fromName = settings.resendFromName || 'DCEL Payroll';

      if (!apiKey || apiKey.trim() === '') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing Resend API Key. Please enter your Resend API Key in Settings > Email and click Save.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const resendAttachments = (attachments || []).map((att: any) => ({
        filename: att.filename || 'Payslip.pdf',
        content: att.content, // Base64 string
      }));

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          from: `"${fromName}" <${fromEmail}>`,
          to: Array.isArray(to) ? to : [to],
          subject: subject || (action === 'test_connection' ? 'DCEL Email Configuration Test' : 'Your Payslip'),
          html: html || '<p>This is a test notification from DCEL Office Suite.</p>',
          attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
        }),
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        let msg = resendData.message || resendData.error || 'Resend delivery failed';
        if (resendRes.status === 403 && typeof msg === 'string' && msg.includes('testing emails')) {
          msg = `Resend Notice (403): The test sender "onboarding@resend.dev" can only send to your own registered Resend email address. To send payslips to other staff, please verify your custom domain at https://resend.com/domains and set it as the Sender Email in Settings.`;
        } else if (resendRes.status === 401) {
          msg = `Resend Notice (401): Invalid API Key. Please verify your API Key in Settings > Email.`;
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: msg,
            statusCode: resendRes.status,
            details: resendData,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, provider: 'resend', data: resendData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    console.error('send-payslip-email internal error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error while dispatching email.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
