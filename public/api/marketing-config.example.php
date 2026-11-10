<?php
// Copy this file to /domains/canal360.run.place/marketing-config.php (outside public_html)
// and fill in the public Supabase project URL and anon key. Never place service_role keys here.
return [
    'supabase_url' => 'https://YOUR_PROJECT.supabase.co',
    'supabase_anon_key' => 'YOUR_SUPABASE_ANON_KEY',
    'upload_dir' => '/domains/canal360.run.place/marketing-uploads',
    'allowed_origins' => ['https://canal360.run.place'],
    'max_bytes' => 104857600,
];

