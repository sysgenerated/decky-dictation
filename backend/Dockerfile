FROM ghcr.io/steamdeckhomebrew/holo-toolchain-go:latest

RUN pacman -Sydd --noconfirm \
    git \
    libxkbcommon \
    pkg-config \
    python-pip \
    scdoc \
    unzip \
    wget

RUN pip3 install vosk --target=/vosk

RUN git clone https://github.com/ideasman42/nerd-dictation.git

RUN git clone https://git.sr.ht/~geb/dotool && cd dotool && ./build.sh

RUN wget https://alphacephei.com/kaldi/models/vosk-model-small-en-us-0.15.zip && unzip vosk-model-small-en-us-0.15.zip && rm vosk-model-small-en-us-0.15.zip

ENTRYPOINT [ "/backend/entrypoint.sh" ]
