"use client"

import React, { useRef, useState, useCallback } from 'react'
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';

import StarterKit from "@tiptap/starter-kit";
import Image from '@tiptap/extension-image';
import { Node, mergeAttributes } from '@tiptap/core';
import {
  MenuButtonBold,
  MenuButtonItalic,
  MenuControlsContainer,
  MenuDivider,
  MenuSelectHeading,
  RichTextEditor,
  type RichTextEditorRef,
} from "mui-tiptap";

// Small Video node for embedding iframes (YouTube/etc)
const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'iframe[src]' }, { tag: 'video[src]' }]
  },
  renderHTML({ HTMLAttributes }) {
    // Render either iframe (embed) or video tag depending on src
    const { src } = HTMLAttributes as { src?: string };
    const attrs = mergeAttributes(HTMLAttributes);
    if (src && (src.includes('youtube.com') || src.includes('youtu.be') || src.includes('player.vimeo.com'))) {
      return ['div', { class: 'rte-video-wrapper' }, ['iframe', mergeAttributes(attrs, { frameBorder: '0', allowFullScreen: 'true' })]];
    }
    // Default to video tag when src is present
    return ['div', { class: 'rte-video-wrapper' }, ['video', mergeAttributes(attrs, { controls: 'true' })]];
  },
});


const Home = () => {
  const rteRef = useRef<RichTextEditorRef>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ type: 'image'|'video'; src: string } | null>(null);
  const [captionText, setCaptionText] = useState('');

  const openImagePicker = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImagePicked: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      rteRef.current?.editor?.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    // clear value so same file can be re-picked later
    e.currentTarget.value = '';
  };

  const openVideoDialog = () => setVideoOpen(true);
  const closeVideoDialog = () => setVideoOpen(false);

  const closeCaptionDialog = () => {
    setCaptionOpen(false);
    setPendingMedia(null);
    setCaptionText('');
  };

  const uploadFileToServer = async (file: File) => {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      return data.url as string;
    } catch (err) {
      console.warn('Upload failed, falling back to DataURL', err);
      return null;
    }
  };

  const handleDroppedFile = async (file: File) => {
    // Try server upload first
    const uploadedUrl = await uploadFileToServer(file);
    if (uploadedUrl) {
      if (file.type.startsWith('image/')) {
        rteRef.current?.editor?.chain().focus().setImage({ src: uploadedUrl }).run();
      } else if (file.type.startsWith('video/')) {
        rteRef.current?.editor?.chain().focus().insertContent({ type: 'video', attrs: { src: uploadedUrl } }).run();
      }
      return;
    }

    // Fallback: read as DataURL and open caption dialog
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      setPendingMedia({ type: file.type.startsWith('image/') ? 'image' : 'video', src });
      setCaptionOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await handleDroppedFile(file);
        }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await handleDroppedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const confirmCaptionInsert = () => {
    if (!pendingMedia) return;
    const { type, src } = pendingMedia;
    if (type === 'image') {
      rteRef.current?.editor?.chain().focus().setImage({ src, alt: captionText || undefined }).run();
    } else {
      rteRef.current?.editor?.chain().focus().insertContent({ type: 'video', attrs: { src, title: captionText || undefined } }).run();
    }
    closeCaptionDialog();
  };

  const insertVideo = () => {
    if (!videoUrl) return;
    // Convert YouTube links to embed form if necessary
    let src = videoUrl;
    const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) src = `https://www.youtube.com/embed/${ytMatch[1]}`;

    rteRef.current?.editor?.chain().focus().insertContent({ type: 'video', attrs: { src } }).run();
    setVideoUrl('');
    closeVideoDialog();
  };

  return (
  <div className="rte-page" onPaste={handlePaste} onDrop={handleDrop} onDragOver={handleDragOver}>
      <RichTextEditor
        ref={rteRef}
        extensions={[StarterKit, Image, Video]} // include image + custom video
        content="<p>Hello world</p>"
        immediatelyRender={false}
        renderControls={() => (
          <MenuControlsContainer className="rte-toolbar">
            <div className="rte-toolbar-left">
              <MenuSelectHeading />
              <MenuDivider />
              <MenuButtonBold />
              <MenuButtonItalic />
            </div>

            <div className="rte-toolbar-right">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImagePicked}
              />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const src = String(reader.result);
                      rteRef.current?.editor?.chain().focus().insertContent({ type: 'video', attrs: { src } }).run();
                    };
                    reader.readAsDataURL(file);
                    e.currentTarget.value = '';
                  }}
                />
              <IconButton size="small" color="primary" onClick={openImagePicker} title="Insert image">
                <PhotoCamera />
              </IconButton>
                <IconButton size="small" color="primary" onClick={() => videoInputRef.current?.click()} title="Upload video">
                <OndemandVideoIcon />
              </IconButton>
                <IconButton size="small" color="primary" onClick={openVideoDialog} title="Insert video by URL">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 14L16 10L10 6V14Z" fill="currentColor"/></svg>
                </IconButton>
            </div>
          </MenuControlsContainer>
        )}
      />

      <div className="rte-actions">
        <Button variant="outlined" onClick={() => console.log(rteRef.current?.editor?.getHTML())}>
          Log HTML
        </Button>
      </div>

      <Dialog open={videoOpen} onClose={closeVideoDialog}>
        <DialogTitle>Insert video</DialogTitle>
        <DialogContent>
          <TextField
            label="Video URL or embed src"
            fullWidth
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtu.be/... or https://www.youtube.com/.."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeVideoDialog}>Cancel</Button>
          <Button onClick={insertVideo} variant="contained">Insert</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={captionOpen} onClose={closeCaptionDialog}>
        <DialogTitle>Add caption / alt text</DialogTitle>
        <DialogContent>
          <TextField value={captionText} onChange={(e) => setCaptionText(e.target.value)} fullWidth placeholder="Caption or alt text (optional)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCaptionDialog}>Cancel</Button>
          <Button onClick={confirmCaptionInsert} variant="contained">Insert</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default Home
