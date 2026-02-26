import React, { useRef, useEffect, useCallback } from 'react';

const TOOLS = [
    { cmd: 'bold', label: 'B', title: 'Bold', style: { fontWeight: 700 } },
    { cmd: 'italic', label: 'I', title: 'Italic', style: { fontStyle: 'italic' } },
    { cmd: 'underline', label: 'U', title: 'Underline', style: { textDecoration: 'underline' } },
    { cmd: 'insertUnorderedList', label: '- List', title: 'Bullet list' },
    { cmd: 'insertOrderedList', label: '1. List', title: 'Numbered list' },
    { cmd: 'formatBlock:H2', label: 'H2', title: 'Heading 2' },
];

export default function RichEditor({ value, onChange, placeholder = 'Enter text...', allowNumberedList = true }) {
    const ref = useRef(null);
    const lastHtml = useRef(value || '');

    // Initialise content once
    useEffect(() => {
        if (ref.current) {
            ref.current.innerHTML = value || '';
            lastHtml.current = value || '';
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const exec = useCallback((cmd, arg = null) => {
        ref.current.focus();
        if (cmd.startsWith('formatBlock:')) {
            document.execCommand('formatBlock', false, cmd.split(':')[1]);
        } else {
            document.execCommand(cmd, false, arg);
        }
        handleInput();
    }, []);

    const handleInput = useCallback(() => {
        if (!ref.current) return;
        const html = ref.current.innerHTML;
        if (html !== lastHtml.current) {
            lastHtml.current = html;
            if (onChange) onChange(html);
        }
    }, [onChange]);

    const visibleTools = allowNumberedList ? TOOLS : TOOLS.filter(t => t.cmd !== 'insertOrderedList');

    return (
        <div>
            <div className="editor-toolbar">
                {visibleTools.map(tool => (
                    <button
                        key={tool.cmd}
                        type="button"
                        className="editor-btn"
                        title={tool.title}
                        style={tool.style || {}}
                        onMouseDown={e => { e.preventDefault(); exec(tool.cmd); }}
                    >
                        {tool.label}
                    </button>
                ))}
            </div>
            <div
                ref={ref}
                className="editor-content"
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onBlur={handleInput}
                data-placeholder={placeholder}
                style={{ minHeight: 120 }}
            />
        </div>
    );
}
