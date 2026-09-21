/******************************************************************************/
/*!
\group  	CtrlAlt
\file		Eze_DialogueScene.cs
\author 	NG Ezekiel Fu Xiang             
\par    	ezekiefuxiang.ng@digipen.edu

	
\date   	XX XX, 2025 [week XX]
\brief		Dialogue scene is additive loaded.
            In charge of playing dialogue.csv and can do
            - Text in Text Box
            - Change Characters
            - Change Sprites
            - Center TextBox
            - Potential PopUps which special keyword component.

\par
        NO TIME TO FILL

\note


Copyright (C) 2025 DigiPen Institute of Technology.
Reproduction or disclosure of this file or its contents without the
prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel.Design;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static System.Net.Mime.MediaTypeNames;

namespace CtrlAltScripts
{
#pragma warning disable CS8601
#pragma warning disable CS8602
#pragma warning disable CS8604
#pragma warning disable CS8618
    public class Eze_DialogueScene : DialogueScript, Eze_SceneInterface
    {
        #region Controls

        [SerializeField] public float fadeTime;

        [SerializeField] public float displaySpeed; //char per second

        public bool isDisplaying = false; // ops have to turn it to public.

        private bool skipLine = false;

        #endregion

        #region Properties

        private string? currentSet = null;

        public  int currentOrder = 0; // sorry need public this for text box.

        #endregion

        #region Font & Feedback Entity Properties

        //[SerializeField] public GameObject bannerObject;

        //[SerializeField] public GameObject flagsObject;

        //[SerializeField] public AudioSource typeWriterAudio;
        //[SerializeField] public AudioSource pageFlipAudio;

        [SerializeField] public GameObject typeWriterAudio;
        [SerializeField] public GameObject pageFlipAudio;

        // this are pointers to which font to set
        public GameObject? currentText_Wrapper; 
        public Font? displayingText;
        public Font? nameText;
        private string? nextNameText;
        public GUIComponent? GUINextButton_Button; // turn active and not active // orh this is a GUIComponent now


        //public List<GameObject> spriteImageList;

        //public List<string> spriteKeyList;

        private Dictionary<string, DialogueScript> CharacterDictionary = new Dictionary<string, DialogueScript>();

        #endregion

        #region DialogueScripts

        [SerializeField] public TestAxol?        Axol;
        [SerializeField] public TestSirNivens?   SirNivens;
        [SerializeField] public TestQueen?       Queen;
        [SerializeField] public TestTextBox?     TextBox;
        [SerializeField] public TestHat?         Hat;
        [SerializeField] public TestHUDSprites?  Huds; 
        #endregion

        #region Feedback DERELIC
        //[SerializeField] public GameObject NextButton; // DERELIC
        //[SerializeField] public GameObject TextBoxBackground; // DERELIC
        //public Renderer NextButton_Button; // turn active and not active // orh this is a GUIComponent now
        #endregion

        #region Timings
        [SerializeField]
        public float TextBoxTransitionAnim = 0.75f;
        [SerializeField]
        public float AnimAlphaFadeOut = 0.5f;
        [SerializeField]
        public float AnimTextBoxFadeIn = 0.5f;
        #endregion

        #region Fade
        IEnumerator StartFadeOut()
        {
            //animator.speed = fadeTime;
            //animator.SetTrigger("Exit");
            float fadecount = 0f;

            while (fadecount <= fadeTime)
            {
                fadecount += Time.deltaTime;
                Eze_Singles.hudManager.SetFadeAlpha(1f - (fadecount/fadeTime));
                yield return new WaitForSeconds(Time.deltaTime);
            }

            SceneSystem.AdditiveUnloadSceneByName("Build_Dialogue");
            Eze_Singles.gameManager.NextScene();

            yield break;
        }

        IEnumerator StartFadeIn(string input)
        {

            if (string.IsNullOrEmpty(input))
            {
                Console.WriteLine("Error: input is null or empty ");

            }

            //animator.speed = fadeTime;
            //animator.SetTrigger("Exit");

            // check input null .

            float fadecount = 0f;

            while (fadecount <= fadeTime)
            {
                fadecount += Time.deltaTime;
                Eze_Singles.hudManager.SetFadeAlpha(fadecount / fadeTime);
                yield return new WaitForSeconds(Time.deltaTime);
            }

            StartDisplayingSet(input);

            yield break;
        }

        #endregion

        //public void ClearSprites()
        //{
        // //   int x = 10;
        //    //foreach (var GameObject in spriteImageList) { GameObject.SetActive( false); }
        //}
        public void StartDisplayingSet(string setToDisplay)
        {
            // SHERMAN do your settings here, probably Curr_Character .
            // the initialising of nameFont, DisplayFont
            /*
             * banner = TextBox.LEFT_UI_Font_TextBox.font;// TextBox.LEFT_UI_TextBox.font; // wrong
               flags = TextBox.LEFT_UI_Font_Name.font;
               GUINextButton_Button = TextBox.LEFT_UI_Arrow_Button.gui;


            */
            // did not assign my pointer
            // DO SOMETHING HERE
            Console.WriteLine("Start Displaying Set -- START");
            currentSet = setToDisplay; // IT WAS NOT ASSIGNMENT
            currentOrder = 0;
            acceptInput = true;
            

            if (Eze_Singles.dialogueManager.setDictionary == null)
            {
                Console.WriteLine("Error: setDictionary is null!");
                
            }

            if (setToDisplay == null)
            {
                Console.WriteLine("Error: setToDisplay is null!");
                setToDisplay = "Set_1"; // stopgap
            }

            if (!Eze_Singles.dialogueManager.setDictionary.ContainsKey(currentSet))

            {
                Console.WriteLine("Error: setDictionary does not contain key {0}", currentSet);
                
            }

            if (Eze_Singles.dialogueManager.setDictionary[currentSet] == null ||
                currentOrder >= Eze_Singles.dialogueManager.setDictionary[currentSet].Length)
            {
                Console.WriteLine("Error: currentOrder {0} is out of range for set {1}", currentOrder, currentSet);
                
            }

            //string initCharacterName = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].character;
#pragma warning disable CS8600
            string initCharacterName = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder]?.character;
            string initspecialKeyWord = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder]?.specialKeyword;

            if (string.IsNullOrEmpty(initCharacterName))
#pragma warning restore CS8600
            {
                Console.WriteLine("Error: character is null or empty for set {0}, order {1}", currentSet, currentOrder);
                
            }

            //if (!string.IsNullOrEmpty(initspecialKeyWord)) // idw it to be here, it shall directly be in Display.
            //{
            //    Huds.OnEnter(initspecialKeyWord);
            //    Curr_SpecialKeyword = initspecialKeyWord;
            //}

            Console.WriteLine("initCharacterName is {0}", initCharacterName);

            if (CharacterDictionary.ContainsKey(initCharacterName)) // pseduo NULL character checker.

            {
                // it is okay if curr character is the same as next character.
                Curr_Character = CharacterDictionary[initCharacterName]; // assumes that the dictionary is ready.
                Console.WriteLine("Curr_Character is {0}", Curr_Character.GetType());
                // changing sprite.
                string currSpriteName = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].sprite;
                Curr_Character.ChangeSprite(currSpriteName); // or change a method call SetSprite.  
                // use like SetSprite instead.
                if (Curr_Character.Character_Side == CHARACTERSIDE.LEFT) 

                {
                    Console.WriteLine("RIGHT UI Intialised ");

                    displayingText = TextBox.LEFT_UI_Font_TextBox.font;// TextBox.LEFT_UI_TextBox.font; // wrong
                    nameText = TextBox.LEFT_UI_Font_Name.font;
                    GUINextButton_Button = TextBox.LEFT_UI_Arrow_Button.gui;
                    currentText_Wrapper = TextBox.LEFT_UI;
                    Tobe_To_NotBeOnScreenLEFT = Curr_Character;

                }
                if (Curr_Character.Character_Side == CHARACTERSIDE.RIGHT)
                {
                    Console.WriteLine("LEFT UI Intialised ") ;
                    displayingText = TextBox.RIGHT_UI_Font_TextBox.font;// TextBox.LEFT_UI_TextBox.font; // wrong
                    nameText = TextBox.RIGHT_UI_Font_Name.font;
                    GUINextButton_Button = TextBox.RIGHT_UI_Arrow_Button.gui;
                    Tobe_To_NotBeOnScreenRIGHT = Curr_Character;
                    currentText_Wrapper = TextBox.RIGHT_UI;

                }
                //else
                //{
                //    //No side
                //}
            }
            else
            {
                Curr_Character = null;
                // should set a center box.
                displayingText = TextBox.CURR_UI_Font_TextBox.font;// TextBox.LEFT_UI_TextBox.font; // wrong
                nameText = TextBox.CURR_UI_Font_Name.font;
                GUINextButton_Button = TextBox.CURR_UI_Arrow_Button.gui;
                currentText_Wrapper = TextBox.CURR_UI;
            }
            Prev_Character = null; // this should be null?
            //Curr_Character =  //Axol; 
            Next_Character = null;

               // null checks
            {   
                // Ensure essential variables are not null before usage
                if (string.IsNullOrEmpty(currentSet)) currentSet = "";
                if (string.IsNullOrEmpty(nextNameText)) nextNameText = "";

                if (displayingText == null) Console.WriteLine("banner is not assigned!");
                if (nameText == null) Console.WriteLine("flags is not assigned!");

                //if (NextButton == null) Console.WriteLine("NextButton is not assigned!");
                //if (TextBoxBackground == null) Console.WriteLine("TextBoxBackground is not assigned!");
                //if (NextButton_Button == null) Console.WriteLine("NextButton_Button is not assigned!");
                if (GUINextButton_Button == null) Console.WriteLine("GUINextButton_Button is not assigned!");

                if (Axol == null) Console.WriteLine("Axol is not assigned!");
                if (SirNivens == null) Console.WriteLine("SirNivens is not assigned!");
                if (Queen == null) Console.WriteLine("Queen is not assigned!");
                if (TextBox == null) Console.WriteLine("TextBox is not assigned!");
                if (Hat == null) Console.WriteLine("Hat is not assigned!");
                if (Huds == null) Console.WriteLine("HudSprites, Huds, is not assigned!");
            }

            Display();
            Console.WriteLine("Start Displaying Set -- END");

            // BUG BUG

            // // DO SOMETHING HERE
            // Console.WriteLine("Start Displaying Set -- START");
            //currentSet = setToDisplay;
            currentOrder = 0; //intelliense says this is not used but it is in line 131
            //acceptInput = true;
            //Display();
            //Console.WriteLine("Start Displaying Set -- END");
        }

       public void DisplayNextInSet()
       {
            if (skipAllDialogues)
            {
                Console.WriteLine("Skipping All Dialogue Triggered. bool is true");
                skipAllDialogues = false;
                Console.WriteLine("Skipped all Dialogues");
                Console.WriteLine("Exiting Scene");

                displayingText.text = "";

                ExitScene("");
                return; // bug should return early
            }
            //if (skipLinedHandled) return; // input lag // sorry not here, but in SkipLine function.

            if (++currentOrder > Eze_Singles.dialogueManager.setDictionary[currentSet].Length - 1)

           {
                Console.WriteLine("Exiting Scene");

                displayingText.text = "";

               ExitScene("");
           }
           else
            {

                // which display should be empty? // maybe both 
                displayingText.text = ""; // force it to prevent XYZ. , a new chat

               Display();
           }
       }


       // ADDED something related to only having one coroutine running at one time and not having runaway coroutine.
       private IEnumerator? dialogueCoroutine;
       private IEnumerator? charCoroutine; // Store the coroutine reference 
        public string? Curr_SpecialKeyword = null; // for special keyword trigger.
        public string? Prev_SpecialKeyword = null; // for special keyword trigger.
        //public string? Next_Character = null;
        public void Display()
       {

            Console.WriteLine("currentorder is: {0}. ", currentOrder);

            Console.WriteLine("currentorder length is: {0}. ", Eze_Singles.dialogueManager.setDictionary[currentSet].Length);

            Console.WriteLine("currentSet is: {0}. ", currentSet);

            
            // I will set the curr and next character here,
            if (currentOrder < Eze_Singles.dialogueManager.setDictionary[currentSet].Length - 1) // this can be negative no.
            {
                // check for the next character.
                // 10 sets , numbered 0-9 . I want to stop at 8 
                string nextCharacterName = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder+1].character;
                if (CharacterDictionary.ContainsKey(nextCharacterName)) // pseduo NULL character checker.
                {
                    // it is okay if curr character is the same as next character.
                    Console.WriteLine("Next Character will be {0}", nextCharacterName);
                    Next_Character = CharacterDictionary[nextCharacterName]; 
                }
                else
                {
                    Next_Character = null;
                }
            }
            else
            {
                // last character in dialogue set.
                Next_Character = null;
            }

            // grab speaker name
            nextNameText = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].speakerName;
            // here

            
            // next scene already, make previous keyword is any disappear.
            //if (!string.IsNullOrEmpty(Curr_SpecialKeyword))
            //{
            //    Console.WriteLine("OnExiting keyword: {0}", Curr_SpecialKeyword);
            //    Huds.OnExit(Curr_SpecialKeyword);
            //    if (Curr_SpecialKeyword.Contains("SLIDE_"))
            //    {
            //        Huds.SLIDESDialogueOn();
            //    }
            //    Curr_SpecialKeyword = null;
            //}// before we update the special keyword, we call the onexit.
            // grab special keyword.
            Curr_SpecialKeyword = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].specialKeyword;
            if (!string.IsNullOrEmpty(Prev_SpecialKeyword)) //&& !string.IsNullOrEmpty(Prev_SpecialKeyword))
            {
                Console.WriteLine("OnExiting keyword: {0}", Prev_SpecialKeyword);
                Huds.OnExit(Prev_SpecialKeyword);

                if (Prev_SpecialKeyword.Contains("SLIDE_"))
                {
                    // logic for it is pop up after pop up,
                    // logic when it is the last SLIDE_ pop up.
                    if (string.IsNullOrEmpty(Curr_SpecialKeyword)) // BUG  Prev_SpecialKeyword 
                        Huds.SLIDESDialogueOn();
                    else if (!Curr_SpecialKeyword.Contains("SLIDE_"))
                        Huds.SLIDESDialogueOn();
                }
                // hmm what do I set null?
                Prev_SpecialKeyword = null;

            }// before we update the special keyword, we call the onexit.
            if (!string.IsNullOrEmpty(Curr_SpecialKeyword))
            {
                Console.WriteLine("OnEntering keyword: {0}", Curr_SpecialKeyword);
                Huds.OnEnter(Curr_SpecialKeyword);

                
            }

            //audioSource.Play();
            Console.WriteLine("Displaying -- START");
           if (dialogueCoroutine != null)
           {
                Console.WriteLine("Removing extra/lingering Dialogue Coroutine");
               this.StopCoroutine(dialogueCoroutine);
           }


            if (Curr_SpecialKeyword.Contains("SLIDE_")) // or I can check if the next word is not SLIDE_ , so I can make multiple SLIDES play.
            {
                // another idea , is that I play this dialogue, then I call the Dialogue OFF and ON , after the dialogue.
                
                Huds.SLIDESDialogueOff();
                this.isDisplaying = true;
                // dont go into dialogue flow.
                // it is not call Next Char.
                    // Week 13 bug, I may want a Next_SpecialKeyword to only call this if no more SLIDES stuff .
                this.Wrapper_ResolveNextCharacter(); // this disable dialogue flow to update next Character.
                    // the current character does not enter the scene, ( probably because the timing is the same.
            }
            else
            {
                dialogueCoroutine = this.StartCoroutine(DialogueFlow());
            }
            


           // This would make it such that the text stuff goes one by one, // if text is blank , it will let it flow.
           // else the other function to call is SkipToEndOfThisLine
           Console.WriteLine("Setting speaker Name");

            Console.WriteLine("Speaker Name Test, {0}", nameText.text); // dont like that it is null?

           //flags.text = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].speakerName;
               //Console.WriteLine("Clearing Sprites [NOT IN USED]");
               //ClearSprites();

            //XXX LOGIC FOR CHANGIN CHARACTER AND SPRITES.
            /* Ezekiel's notes for Sherman:
             * Loop through the keys on current Dialogue and display
             * SO I need to keep track of Current , Prev and Next Character
             * and checking against the sprite if it changes.   // dont need to fade , just go.
             *
             * 
            */
            //foreach (string spriteKey in Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].character)
            //{
            //    // Need to make a CharDict.
            //    //if (spriteDictionary.ContainsKey(spriteKey))
            //    {
            //        //spriteDictionary[spriteKey].enabled = true;
            //    }

            //}
            
            Console.WriteLine("Displaying -- END");
            Prev_SpecialKeyword = Curr_SpecialKeyword;
        }



        public void SkipToEndOfThisLine()
        {
            // should not be able to spam skipLine
            if (skipLinedHandled) return;
            skipLine = true;
                // either this force the line to appear,
                // or CharbyChar uses "finalText" to make the text appear
                   // probably bugging is banner is not set.
            //displayingText.text = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].textToDisplay;    // QUESTION: will this ensure reliablity?
            if (!isDisplaying) return; // optional , assumes that you want to leave if TextBook is ready for next line. So maybe put at the top?
        }


        public DialogueScript? Curr_Character = null;
        public DialogueScript? Next_Character = null;
        public DialogueScript? Prev_Character = null;
        private DialogueScript? To_NotBeOnScreen = null;
        public DialogueScript? Tobe_To_NotBeOnScreenLEFT = null; // need this
        public DialogueScript? Tobe_To_NotBeOnScreenRIGHT = null; // need this
        IEnumerator DialogueFlow()
        {
            Console.WriteLine("Start of DialogueFlow");
            isDisplaying = true; // put here to make Left MB invalid till CharByChar release it to false.

            if (Curr_Character != null)
            {
                Console.WriteLine("Curr_Character is {0}", Curr_Character.GetType().Name);
            }
            if (Next_Character != null)
            {
                Console.WriteLine("Next_Character is {0}", Next_Character.GetType().Name);
            }
            if (Prev_Character != null)
            {
                Console.WriteLine("Prev_Character is {0}", Prev_Character.GetType().Name);
            }

            if (Curr_SpecialKeyword != null)
            {
                Console.WriteLine("Curr_SpecialKeyword is {0}", Curr_SpecialKeyword); 
            }


            // Handling OnEnter.



            // turn off Curr/Prev Character for NextCharacter(which is curr character)
            if (To_NotBeOnScreen != null)
            {
                Console.WriteLine("To_NotBeOnScreen is {0}", To_NotBeOnScreen.GetType().Name);
                // should I turn alpha to 0.0f instead? or luminance to 0.5f
                To_NotBeOnScreen.ResetSpriteVisibility();

                // but visibility should be false ._.
                To_NotBeOnScreen.Curr_Sprite.renderer.visibility = false;
                To_NotBeOnScreen.Curr_Sprite.renderer.alpha = 1.0f;
                To_NotBeOnScreen.Curr_Sprite.renderer.luminance = 1.0f;
                To_NotBeOnScreen.isOnScreen = false; // I am loosing this character on the next update. 
                nameText.text = ""; // may not be successful
                To_NotBeOnScreen = null;
            }


            //========================================== || ============================
            // CURR CHAR ENTERING & CHANGIN SPRITE Check || NAMETEXT COLOUR CHANGING
            //========================================== || =============================
            // need to check if character has enter.
            if (Curr_Character != null)// && Curr_Character.isOnScreen == false) // why must i check isOnScreen false?
            {

                if (currentOrder  < Eze_Singles.dialogueManager.setDictionary[currentSet].Length) // can remove this

                { // on screen and want to change sprite to next one.
                    // changing sprite. || Do at the end of dialogue flow. || UPDATE : should do at the start of the seen
                    string currSpriteName = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].sprite; // BUG  currentOrder + 1
                    Curr_Character.ChangeSprite(currSpriteName); // assumes Curr Char and next order character is the same. || if not the same hope it is still isOnScreen == false.
                                                                 // do the nametext changing here? // sure lets do it.
                    GameObject? NameText_ToChange;

                    if (Curr_Character.Character_Side == CHARACTERSIDE.LEFT)
                        NameText_ToChange = TextBox.LEFT_UI_TextName;
                    else// if (dir == CHARACTERSIDE.RIGHT)
                        NameText_ToChange = TextBox.RIGHT_UI_TextName;
                    // need condition if there is no NameText

                    if (Curr_Character.GetType() == Queen.GetType()) // is this consistent?

                    {
                        // this is too early.
                        // need to know its allignment.
                        if (Queen.Curr_Sprite == Queen.Queen_Blue)
                            TextBox.ChangeTextNameColour(NameText_ToChange, TestTextBox.ALLIGNMENT.BLUE);
                        else if (Queen.Curr_Sprite == Queen.Queen_Red)
                            TextBox.ChangeTextNameColour(NameText_ToChange, TestTextBox.ALLIGNMENT.RED);
                    }
                    else
                    {
                        // rest of the characters are NEUTRAL.
                        //this.ResetTextNameColour(); // orh I cannot universally clear to NEUTRAL, I need to dictate whether left or right.
                        TextBox.ChangeTextNameColour(NameText_ToChange, TestTextBox.ALLIGNMENT.NEUTRAL);
                    }

                }


                if (Curr_Character.isOnScreen == false)
                {
                    IEnumerator EnteringAnimation =
                        this.StartCoroutine(OnEnter(Curr_Character.Curr_Sprite, CalculateStart(Curr_Character.Curr_Sprite, ENTERING_DIR.BOTTOM),

                       Curr_Character.Curr_Sprite.transform.position, Curr_Character.EnterDuration, MathLib.EaseOutBounceOnce));
                    while (this.IsCoroutineRunning(EnteringAnimation))
                    {
                        yield return new WaitForSeconds(0.25f);
                    }
                    //yield return EnteringAnimation;
                    Curr_Character.isOnScreen = true;
                }
                
               
            }// end of handling current sprite/character update.

            //========================================== 
            // Moving of TextBox Anim. 
            //========================================== 
            // Need to know to Move the Box.
            //if (Curr_Character != null &&( Prev_Character == null || Curr_Character != Next_Character) ) // if prev character is null, I need to move the text box 
            if (Curr_Character != null && (Prev_Character == null || Curr_Character != Prev_Character)) // the change(wanted) seek prev and curr.
            {
                // CASE H A H --> A H H --> H H H , for A H H , Curr == Next character. and fail to move rather than because Axol is not speaking now and Hat is speaking.

                Console.WriteLine("Start of MoveTextBox");
                // initiate Moving Text box.
                // change the colour of namebox if needed.

                // need to compare character side and call off screen.
                if (Prev_Character == null || (Prev_Character != null && Curr_Character.Character_Side != Prev_Character.Character_Side)) // last anti-check (exclusion case)
                {
                    // last check if it is not same side.)
                    IEnumerator TextBoxAnimation =
                    this.StartCoroutine(TextBox.MoveTextBox(Curr_Character.Character_Side, TextBox.CURR_UI_TextBox_Anim, TextBoxTransitionAnim)); // CURR_UI is just a tmp animation object  
                    while (this.IsCoroutineRunning(TextBoxAnimation))
                    {
                        yield return new WaitForSeconds(0.5f);
                    }
                }
                //yield return (TextBoxAnimation);
            }
            //else if (Curr_Character == Next_Character){ 
            // same character but can have different sprite. 
            // this was already settled below.
            // I want to change the NameText now?
            // derelic --> wanted to change after textbox move.


            //}
            else if (Curr_Character == null)
            {
                // probably use the center TextBox ( HAVE NOT CREATED )
                // set displaying text font comp to this center textbox XYZ.


                // M6 STUFFF
                // need to lerp it to center. or check if it is center. 
                if (this.currentOrder == 0 || (Curr_Character == null && (Prev_Character != null)) )
                {
                    Console.WriteLine("Calling CENTER TextBox Anim.");
                    // assume that 
                    IEnumerator TextBoxAnimation =
                    this.StartCoroutine(TextBox.MoveTextBox(CHARACTERSIDE.TEXTBOX_CENTER, TextBox.CURR_UI_TextBox_Anim, TextBoxTransitionAnim)); // CURR_UI is just a tmp animation object  
                    while (this.IsCoroutineRunning(TextBoxAnimation))
                    {
                        yield return new WaitForSeconds(0.5f);
                    }
                }
                

            }//end of checks to move textBox.


            Console.WriteLine("Start of CharByChar");
            // start the CharByChar.
            if (charCoroutine != null)
            {
                this.StopCoroutine(charCoroutine);
            }
            nameText.text = nextNameText; // OR Dict[][current order].name // assign here

            // start coroutine, 
            // should not allow more skipline after the initial possible skip line to allow user to understand that the text box is done. 
            charCoroutine = this.StartCoroutine(CharByChar());


            //// Wait for CharByChar to end,
            //// prepare for next dialogue here
            while (this.IsCoroutineRunning(charCoroutine))
            {
                yield return new WaitForSeconds(0.5f); //? what should i set.
            }
            //yield return charCoroutine;
            Console.WriteLine("End of CharByChar");
                // done at Display, grabbing current order's speaker name.

            if (Next_Character != null) // deciding which one to exit screen here,
            {
                // need to validate both .
                CHARACTERSIDE NextCharSide = Next_Character.Character_Side;

                Console.WriteLine("[DEBUG] NextCharacter is " + Next_Character.GetType().Name);
                if (Tobe_To_NotBeOnScreenRIGHT != null)
                    Console.WriteLine("[DEBUG] Tobe_To_NotBeOnScreenRIGHT is " + Tobe_To_NotBeOnScreenRIGHT.GetType().Name);
                //Console.WriteLine("[DEBUG] Tobe_To_NotBeOnScreenLEFT is " + Tobe_To_NotBeOnScreenLEFT.GetType().Name);
                if (Tobe_To_NotBeOnScreenLEFT != null && NextCharSide == Tobe_To_NotBeOnScreenLEFT.Character_Side 
                    && Tobe_To_NotBeOnScreenLEFT.GetType() != Next_Character.GetType() )
                {
                    Console.WriteLine("Next to be Removed is {0}", Tobe_To_NotBeOnScreenLEFT.GetType().Name);
                    To_NotBeOnScreen = Tobe_To_NotBeOnScreenLEFT;
                    Tobe_To_NotBeOnScreenLEFT = null; // BUG replace with the next char.
                    Tobe_To_NotBeOnScreenLEFT = Next_Character;

                }
                if (Tobe_To_NotBeOnScreenRIGHT != null && NextCharSide == Tobe_To_NotBeOnScreenRIGHT.Character_Side 
                    && Tobe_To_NotBeOnScreenRIGHT.GetType() != Next_Character.GetType() )
                {
                    Console.WriteLine("Next to be Removed is {0}", Tobe_To_NotBeOnScreenRIGHT.GetType().Name);
                    To_NotBeOnScreen = Tobe_To_NotBeOnScreenRIGHT;
                    Tobe_To_NotBeOnScreenRIGHT = null; // redundant.
                    Tobe_To_NotBeOnScreenRIGHT = Next_Character;
                }

                //Console.WriteLine("NextCharSide is {0} ", Next_Character.GetType().Name);
                //if (Prev_Character != null)
                //{
                //    if ((NextCharSide == Prev_Character.Character_Side) && (Next_Character.GetType() != Prev_Character.GetType()))
                //    {
                //        Console.WriteLine("Next to be Removed is {0}", Prev_Character.GetType().Name);
                //        To_NotBeOnScreen = Prev_Character;
                //    }
                //}

                //if (Curr_Character != null)
                //{
                //    if ((NextCharSide == Curr_Character.Character_Side) && (Next_Character.GetType() != Curr_Character.GetType()))
                //    {
                //        Console.WriteLine("Next to be Removed is {0}", Curr_Character.GetType().Name);
                //        To_NotBeOnScreen = Curr_Character;
                //    }
                //}

               
            }// end of checking who should exit from scene.


            
           

            if (Next_Character != null)
            {
                //if (Curr_Character == null)
                //{
                //    // orh there could be 2 character. if 2 dialogues are EMPTY characters.
                //    // prev character would be lost and I need to remember if it should be not of screen.
                // orh Week 13, I needed this again lol.
                //    if (Tobe_To_NotBeOnScreen1 == null)
                //    {
                //        Tobe_To_NotBeOnScreen1 = Prev_Character; // could be null btw.
                //    }
                //    else
                //    {
                //        Tobe_To_NotBeOnScreen2 = Prev_Character;
                //    }
                //}
                Prev_Character = Curr_Character;  // Store current before updating
                Curr_Character = Next_Character;  // Move Next -> Curr
                Next_Character = null;  // Reset Next so it can be assigned properly in the next update
            }
            else
            {
                Prev_Character = Curr_Character;
                Curr_Character = null;  // No next character means no speaking character
            }

            


            // here we should assign the next character?
            // dont update first.

            //BUG I NEED TO BRING OUT isDisplaying text outside here for display to not interfer.
            isDisplaying = false; // from CharByChar.

            yield break;
        }

        IEnumerator CharByChar()
        {
            // Ensure banner is not null
            // orh it will be set as empty.
            Console.WriteLine("CharByChar Coroutine -- START");
            if (displayingText == null)
            {
                Console.WriteLine("banner is null!");
                yield break;
            }

            // Ensure dialogueManager and dictionary exist
            if (Eze_Singles.dialogueManager == null )
            {
                Console.WriteLine("Dialogue Manager is missing!");
                yield break;
            }

            if (!Eze_Singles.dialogueManager.setDictionary.ContainsKey(currentSet))
            {

                Console.WriteLine("Dialogue data is missing!");
                yield break;
            }
            GUINextButton_Button.visibility = false;
                //isDisplaying = true; // put it in dialogue flow

            displayingText.text = "";

            float perSecond = 1 / displaySpeed;
            string finalText = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].textToDisplay; // here.

            // Ensure finalText is valid
            if (string.IsNullOrEmpty(finalText))
            {
                
                Console.WriteLine("Final text is empty or null.");
                Console.WriteLine("currentSet is {0}.", currentSet);
                Console.WriteLine("currentOrder is {0}.", currentOrder);

                //isDisplaying = false; // isDisplaying is set at the end of dialogueFlow.
                yield break;
            }
            else
            {
                Console.WriteLine("Final text is {0}.", finalText);
            }

            typeWriterAudio.GetComponent<AudioSource>().Play(); 

            skipLine = false; // stopgap from spam clicking.

            foreach (char c in finalText)
            {
                if (!skipLine)
                {
                    displayingText.text += c; // Avoids unnecessary ToString()
                    yield return new WaitForSeconds(perSecond);
                }
                else
                {
                    displayingText.text = finalText; // if want to do it here.
                    skipLine = false;
                    break;
                }
            }
            typeWriterAudio.GetComponent<AudioSource>().Stop();
            //isDisplaying = false; // move to end of DialogueFlow
            GUINextButton_Button.visibility = true;
            GUINextButton_Button.alpha = 1.0f;
            Console.WriteLine("CharByChar Coroutine -- END");
            yield break;
        }


        //IEnumerator CharByChar()
        //{
        //    isDisplaying = true;
        //    banner.text = "";
        //    //Debug.Log("Starting Char By Char");
        //    float perSecond = 1 / displaySpeed;
        //    //Debug.Log($"{currentOrder}");
        //    string finalText = Eze_Singles.dialogueManager.setDictionary[currentSet][currentOrder].textToDisplay;
        //    //Debug.Log($"{finalText}");
        //    foreach (char c in finalText)
        //    {
        //        if (skipLine == false)
        //        {
        //            //Debug.Log($"{c}");
        //            banner.text += c.ToString();
        //            yield return new WaitForSeconds(perSecond);
        //        }
        //        else
        //        {
        //            skipLine = false;
        //            break;
        //        }
        //    }
        //    isDisplaying = false;
        //    yield break;
        //}



        #region Scene Interface
        public void EnterScene(string input)
        {
            Console.WriteLine("Entering Dialogue Scene -- START");
            this.StartCoroutine(StartFadeIn(input));
            Console.WriteLine("Entering Dialogue Scene -- FINISHED");
        }

        public void ExitScene(string input)
        {

            if (charCoroutine != null)
            {
                Console.WriteLine("stop charCoroutine"); // should it be char or DialogueFlow ?
                this.StopCoroutine(charCoroutine);
                charCoroutine = null; // Reset reference
            }
            if (dialogueCoroutine !=  null)
            {
                Console.WriteLine("stop dialogueCoroutine"); // should it be char or DialogueFlow ?
                this.StopCoroutine(dialogueCoroutine);
                dialogueCoroutine = null; // Reset reference
            }

            if (!string.IsNullOrEmpty(Curr_SpecialKeyword))
            {
                // cleanly exit it ? // actually it might stop it self (when exit scene stops all coroutine) but it should be okay as we got the animation.
                Huds.OnExit(Curr_SpecialKeyword);
                Curr_SpecialKeyword = null;
            }


            //Prevents further clicking
            acceptInput = false;

            this.StartCoroutine(StartFadeOut());

            // should it wait here?

            //Debug.Log("Started Dialogue Fade Out");
            Eze_Singles.dialogueManager.EmptyDialogueScene(this);
        }
        #endregion
        public override void Initialize()
        {
            /*
            for (int i = 0; i < spriteImageList.Count; i++)
            {
                //Debug.Log($"Adding Sprite Key: {spriteKeyList[i]}");
                //Debug.Log($"and Sprite Image {spriteImageList[i]}");
                spriteDictionary.Add(spriteKeyList[i], spriteImageList[i]);
            }
            */

            /*
            banner = GameObject.FindGameObjectByName("Dialogue_Display_Text").GetComponent<Font>();
            flags = GameObject.FindGameObjectByName("Dialogue_Name_Text").GetComponent<Font>();
             */

            //banner = bannerObject.GetComponent<Font>();
            //flags = flagsObject.GetComponent<Font>();
            //NextButton_Button = NextButton.GetComponent<Renderer>();

            // should I be assign anything here?
            //if (bannerObject == null)
            //    Console.WriteLine("bannerObject is null!");
            //if (flagsObject == null)
            //    Console.WriteLine("flagsObject is null!");
            //if (NextButton_Button == null)
            //{
            //    Console.WriteLine("Assign GameObject to NextButton.");
            //}

            Console.WriteLine("Dialogue Scene Setting Dialogue Manager");
            Eze_Singles.dialogueManager.SetDialogueScene(this);
            Console.WriteLine("Dialogue Scene Setting Game Manager");
            Eze_Singles.gameManager.SceneInitialised(this);
            typeWriterAudio.ReinitialiseGameObject();
            pageFlipAudio.ReinitialiseGameObject();

            if (Axol == null)
            {
                Console.WriteLine("Error Assign GameObject to Axol.");
            }
            if (SirNivens == null)
            {
                Console.WriteLine("Error Assign GameObject to SirNivens.");
            }
            if (Queen == null)
            {
                Console.WriteLine("Error Assign GameObject to Queen.");
            }
            if (Hat == null)
            {
                Console.WriteLine("Error Assign GameObject to Hat.");
            }


            this.CharacterDictionary.Clear();
            this.CharacterDictionary.Add("Axol", Axol);  
            this.CharacterDictionary.Add("Nivens", SirNivens);   //  BUG"Nivins", SirNivens);
            this.CharacterDictionary.Add("Queen", Queen); 
            this.CharacterDictionary.Add("Hat", Hat);
            //this.CharacterDictionary.Add("EMPTY", null);  // think about it.


            Curr_Character = null;
             Next_Character = null;
             Prev_Character = null;
             To_NotBeOnScreen = null;

            this.skipLine = false;
            this.isDisplaying = false;
            this.inputHandled = false;
            this.skipLinedHandled = false;
            this.acceptInput = false;
            this.skipAllDialogues = false;



            this.nameText = null;
            this.GUINextButton_Button = null;

            this.currentSet = null;
            this.currentOrder = 0;
    }

        //public override void ResetSpriteVisibility()
        //{
        //    // dk if you want  to do something here.
        //    //TextBoxBackground.renderer.visibility = false;
        //    int x = 10;
        //}


        // ADDED IMPT: To prevent multiple Left clicked.
        private bool inputHandled = false; // Prevents rapid input issues

        // ADDED IMPT: (Eze) To prevent inputs as the scene fades out. This will accidently run you through several scenes
        private bool acceptInput = false;
        private bool skipLinedHandled = false; // Allow user to recognise that skip line has occured

        public bool skipAllDialogues = false;


        private IEnumerator? handle1Coroutine;
        private IEnumerator? handle2Coroutine; // Store the coroutine reference 
        public override void Update(float delta)
        {

            if (Input.IsKeyDown(Keycode.M))
            {
                //Console.WriteLine("Skipping All Dialogue Triggered. bool is true");
                // maybe can allow early termination.
                skipAllDialogues = true;
            }
            else
            {
                skipAllDialogues = false;
            }
            if (inputHandled) return;

            

            if (acceptInput == true && Input.IsKeyTriggered( Keycode.Enter) /* Input.IsMouseTriggered(MouseButton.LEFT) || && Input.IsKeyDown(Keycode.X)*/) // FOR DEBUGGING and CLICKING AROUND THE EDITOR.
            {

                if (isDisplaying == false)
                {
                    pageFlipAudio.GetComponent<AudioSource>().Play();
                    DisplayNextInSet();
                }
                else
                {
                    SkipToEndOfThisLine();
                    skipLinedHandled = true;
                    handle1Coroutine =
                    this.StartCoroutine(ResetSkipLinedHandled()); // BUG ResetInputHandled()

                }
                inputHandled = true;
                handle2Coroutine =
                this.StartCoroutine(ResetInputHandled());
            }// end of "Enter" Key.


        }

        // Small delay to reset input flag
        IEnumerator ResetInputHandled()
        {
            yield return new WaitForSeconds(1 / 60.0f); // Adjust delay as needed
            inputHandled = false;
        }

        IEnumerator ResetSkipLinedHandled()
        {
            yield return new WaitForSeconds(15 / 60.0f); // Adjust delay as needed // can go up to 0.5 a second.
            skipLinedHandled = false;
        }


        public override void OnDestroy()
        {
            this.ClearCoroutines();
            if (charCoroutine != null)
            {
                this.StopCoroutine(charCoroutine);       
            }
            if (dialogueCoroutine != null)
            {
                this.StopCoroutine(dialogueCoroutine);        
            }
            if (handle1Coroutine != null)
            {
                this.StopCoroutine(handle1Coroutine);       
            }
            if (handle2Coroutine != null)
            {
                this.StopCoroutine(handle2Coroutine);        
            }
        }


        private void Wrapper_ResolveNextCharacter()
        {

            if (Next_Character != null) // deciding which one to exit screen here,
            {
                // need to validate both .
                CHARACTERSIDE NextCharSide = Next_Character.Character_Side;


                if (Tobe_To_NotBeOnScreenLEFT != null && NextCharSide == Tobe_To_NotBeOnScreenLEFT.Character_Side
                    && Tobe_To_NotBeOnScreenLEFT.GetType() != Next_Character.GetType())
                {
                    Console.WriteLine("Next to be Removed is {0}", Tobe_To_NotBeOnScreenLEFT.GetType().Name);
                    To_NotBeOnScreen = Tobe_To_NotBeOnScreenLEFT;
                    Tobe_To_NotBeOnScreenLEFT = null;
                }
                if (Tobe_To_NotBeOnScreenRIGHT != null && NextCharSide == Tobe_To_NotBeOnScreenRIGHT.Character_Side
                    && Tobe_To_NotBeOnScreenRIGHT.GetType() != Next_Character.GetType())
                {
                    Console.WriteLine("Next to be Removed is {0}", Tobe_To_NotBeOnScreenRIGHT.GetType().Name);
                    To_NotBeOnScreen = Tobe_To_NotBeOnScreenRIGHT;
                    Tobe_To_NotBeOnScreenRIGHT = null;
                }

            }// end of checking who should exit from scene.

            if (Next_Character != null)
            {
                Prev_Character = Curr_Character;  // Store current before updating
                Curr_Character = Next_Character;  // Move Next -> Curr
                Next_Character = null;  // Reset Next so it can be assigned properly in the next update
            }
            else
            {
                Prev_Character = Curr_Character;
                Curr_Character = null;  // No next character means no speaking character
            }
        }

    }//class
#pragma warning restore CS8601
#pragma warning restore CS8602
#pragma warning restore CS8604
#pragma warning restore CS8618
}//namespace
