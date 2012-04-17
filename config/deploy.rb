set :application, "Medusa"

set :scm, :git
set :repository,  "git@github.com:getteamup/Medusa.git"
set :branch, "production"
ssh_options[:forward_agent] = true #uses the local machine's SSH keys instead of those on the remote server for cloning the repo

role :app, "medusa"
set :user, 'ubuntu'
set :admin_runner, "ubuntu"
set :use_sudo, false
ssh_options[:keys] = [File.join(ENV["HOME"], ".ssh", "externalkey.pem")] 
set :deploy_via, :remote_cache
set :deploy_to, "/home/ubuntu/apps/#{application}"

namespace :deploy do
  task :start, :roles => :app do 
    run "supervisor start #{current_path}/server.js &"
  end
  task :stop, :roles => :app do 
    run "killall node"
  end
  task :restart, :roles => :app, :except => { :no_release => true } do
    run "cd #{current_path} && npm install"
    run "killall node"
    run "supervisor start #{current_path}/server.js &"
  end
end