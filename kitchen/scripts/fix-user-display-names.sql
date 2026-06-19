-- Remove "Demo" labels from chef accounts (run once on VPS)
UPDATE users SET display_name = 'Chef (full kitchen)' WHERE username = 'chef_full';
UPDATE users SET display_name = 'Chef (operational)' WHERE username = 'chef_ops';
