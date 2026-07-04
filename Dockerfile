FROM nikolaik/python-nodejs:python3.11-nodejs20
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-server \
 && rm -rf /var/lib/apt/lists/*
USER pn
# ホスト鍵は PVC(/home/pn/ssh-host)に置き、Pod 再作成でも鍵警告を出さない
CMD ["sh", "-c", "mkdir -p $HOME/ssh-host && [ -f $HOME/ssh-host/ssh_host_ed25519_key ] || ssh-keygen -t ed25519 -N '' -f $HOME/ssh-host/ssh_host_ed25519_key; exec /usr/sbin/sshd -D -e -f /etc/ssh-config/sshd_config"]
